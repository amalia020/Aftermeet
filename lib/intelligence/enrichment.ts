import type {
  ContactCandidate,
  EvidenceBundle,
  ExtractionHandoff,
  PublicEntityContext,
  SourceRecord
} from "@/lib/types";
import {
  saveEvidenceBundle,
  saveEvidenceFacts,
  savePublicEntityContext,
  saveSourceRecords
} from "@/lib/db/queries";
import { calaEntitySearch, calaRetrieveEntity } from "@/lib/providers/cala";
import { geminiWebContext } from "@/lib/providers/gemini";
import { summarizeEntityResolution } from "@/lib/intelligence/entityResolution";
import { buildEvidenceFacts } from "@/lib/intelligence/factConfidence";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import { inferSourceTypeFromUrl } from "@/lib/intelligence/utils";

export function shouldEnrich(input: {
  contactCandidate: ContactCandidate;
  atoms: ExtractionHandoff["atoms"];
  opportunityHints: ExtractionHandoff["opportunityHints"];
  objective: ExtractionHandoff["objective"];
}): boolean {
  const hasPublicLookupTarget = Boolean(
    input.contactCandidate.company || input.contactCandidate.website || input.contactCandidate.email
  );
  const highHint = input.opportunityHints.some((hint) => hint.score >= 0.45);
  const publicContextCouldChangeAction = [
    "find_users",
    "find_design_partners",
    "find_customers",
    "raise",
    "find_partners",
    "source_candidates"
  ].includes(input.objective.primaryGoal);
  const explicitInterest = input.atoms.facts.some((fact) =>
    /\b(interested|try|pilot|customer|invest|hire|partner|funding|series)\b/i.test(fact.text)
  );

  return hasPublicLookupTarget && (highHint || publicContextCouldChangeAction || explicitInterest);
}

function sourceProviderForContext(provider: PublicEntityContext["provider"]): SourceRecord["provider"] {
  return provider === "gemini" ? "web" : provider;
}

function createConversationSource(handoff: ExtractionHandoff): SourceRecord {
  return createSourceRecord({
    provider: handoff.sourceRecord.provider,
    sourceType: handoff.sourceRecord.sourceType,
    contactId: handoff.conversation.contactId ?? null,
    retrievedAt: handoff.sourceRecord.retrievedAt,
    notes: "User-created conversation capture"
  });
}

function webQueryFor(handoff: ExtractionHandoff): string {
  const candidate = handoff.contactCandidate;
  return [
    candidate.name,
    candidate.role,
    candidate.company,
    "professional context funding events company"
  ]
    .filter(Boolean)
    .join(" ");
}

export async function enrichEvidence(handoff: ExtractionHandoff): Promise<EvidenceBundle> {
  const warnings: string[] = [];
  const attempted = shouldEnrich({
    contactCandidate: handoff.contactCandidate,
    atoms: handoff.atoms,
    opportunityHints: handoff.opportunityHints,
    objective: handoff.objective
  });

  const sourceRecords: SourceRecord[] = [createConversationSource(handoff)];
  const publicContext: PublicEntityContext[] = [];
  let calaAttempted = false;
  let webFallbackAttempted = false;

  let entityResolution = summarizeEntityResolution({
    captured: handoff.contactCandidate,
    score: attempted ? 0.25 : 1
  });

  if (attempted) {
    calaAttempted = true;
    const queryTarget =
      handoff.contactCandidate.company ??
      handoff.contactCandidate.website ??
      handoff.contactCandidate.name ??
      "";
    const candidates = queryTarget ? await calaEntitySearch(queryTarget) : [];
    const selectedCandidate = candidates[0];
    const selectedDetail = selectedCandidate
      ? await calaRetrieveEntity(selectedCandidate.providerEntityId)
      : null;

    if (selectedCandidate && selectedDetail) {
      entityResolution = summarizeEntityResolution({
        captured: handoff.contactCandidate,
        candidateName:
          selectedCandidate.entityType === "person" ? selectedCandidate.name : handoff.contactCandidate.name,
        candidateCompany: selectedCandidate.company ?? selectedDetail.canonicalName,
        candidateRole: selectedCandidate.role,
        candidateDomain: selectedCandidate.domain,
        lastUpdated: selectedDetail.retrievedAt
      });

      const context: PublicEntityContext = {
        id: `ctx_${crypto.randomUUID()}`,
        contactId: handoff.conversation.contactId ?? null,
        provider: "cala",
        providerEntityId: selectedDetail.providerEntityId,
        entityType: selectedDetail.entityType,
        canonicalName: selectedDetail.canonicalName,
        rawContext: selectedDetail.rawContext,
        retrievedAt: selectedDetail.retrievedAt,
        confidence: entityResolution.score
      };
      publicContext.push(context);
      sourceRecords.push(
        createSourceRecord({
          provider: "cala",
          sourceType: "cala_verified_fact",
          contactId: handoff.conversation.contactId ?? null,
          sourceName: selectedDetail.canonicalName,
          retrievedAt: selectedDetail.retrievedAt,
          notes: "Structured Cala entity context"
        })
      );
    } else {
      warnings.push("Cala returned no matching entity context.");
    }

    const shouldRunWebFallback =
      entityResolution.label === "low" ||
      entityResolution.label === "no_match" ||
      publicContext.length === 0;

    if (shouldRunWebFallback) {
      webFallbackAttempted = true;
      const webContext = await geminiWebContext({
        name: handoff.contactCandidate.name ?? undefined,
        company: handoff.contactCandidate.company ?? undefined,
        role: handoff.contactCandidate.role ?? undefined,
        query: webQueryFor(handoff)
      });
      const citedClaims = webContext.claims.filter((claim) => claim.sourceUrl);
      const discardedClaims = webContext.claims.length - citedClaims.length;
      if (discardedClaims > 0) {
        warnings.push(`${discardedClaims} web claims discarded because they had no citation URL.`);
      }
      if (webContext.available && citedClaims.length > 0) {
        for (const claim of citedClaims) {
          sourceRecords.push(
            createSourceRecord({
              provider: "web",
              sourceType: claim.sourceType ?? inferSourceTypeFromUrl(claim.sourceUrl),
              contactId: handoff.conversation.contactId ?? null,
              sourceName: new URL(claim.sourceUrl).hostname,
              sourceUrl: claim.sourceUrl,
              retrievedAt: webContext.retrievedAt,
              notes: "Gemini grounded web fallback citation"
            })
          );
        }
        publicContext.push({
          id: `ctx_${crypto.randomUUID()}`,
          contactId: handoff.conversation.contactId ?? null,
          provider: "gemini",
          providerEntityId: null,
          entityType: handoff.contactCandidate.company ? "company" : "unknown",
          canonicalName: handoff.contactCandidate.company ?? handoff.contactCandidate.name ?? null,
          rawContext: {
            summary: webContext.summary,
            facts: citedClaims.map((claim) => ({
              text: claim.text,
              sourceUrl: claim.sourceUrl
            }))
          },
          retrievedAt: webContext.retrievedAt,
          confidence: Math.min(0.72, entityResolution.score)
        });
      } else {
        warnings.push("Gemini web fallback returned no cited professional context.");
      }
    }
  }

  const evidenceFacts = buildEvidenceFacts({
    handoff,
    publicContext,
    sourceRecords,
    entityMatchConfidence: entityResolution.score
  });

  let status: EvidenceBundle["enrichment"]["status"] = "skipped";
  if (attempted && publicContext.length === 0) status = "public_context_unavailable";
  else if (attempted && publicContext.length > 0 && warnings.length > 0) status = "partial";
  else if (attempted && publicContext.length > 0) status = "available";

  const bundle: EvidenceBundle = {
    requestId: handoff.requestId,
    userId: handoff.userId,
    conversationId: handoff.conversation.id,
    contactId: handoff.conversation.contactId ?? undefined,
    contactCandidate: handoff.contactCandidate,
    publicContext,
    sourceRecords,
    evidenceFacts,
    entityResolution,
    enrichment: {
      attempted,
      calaAttempted,
      webFallbackAttempted,
      status,
      warnings
    }
  };

  await saveSourceRecords(sourceRecords);
  await savePublicEntityContext(publicContext);
  await saveEvidenceFacts(evidenceFacts);
  await saveEvidenceBundle(bundle);

  return bundle;
}

export function sourceProviderForPublicContext(
  provider: PublicEntityContext["provider"]
): SourceRecord["provider"] {
  return sourceProviderForContext(provider);
}
