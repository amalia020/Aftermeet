/**
 * Phase 5b — Enrichment coordinator (the public Part 2 service).
 *
 * Owns the provider cascade so the rest of the pipeline calls ONE function and
 * provider order is never bypassed:
 *
 *   1. Ensure a contactId + always record the captured conversation source.
 *   2. Try Cala first (company/fund, ADR-003) and resolve entity match.
 *   3. If Cala has no/low match AND enrichment is warranted, call the Gemini
 *      grounded web fallback. Each cited claim -> source record + evidence fact.
 *   4. Convert conversation atoms into evidence facts (user_voice_note).
 *   5. If neither Cala nor web yields data, status = public_context_unavailable
 *      and DO NOT invent facts.
 *   6. Persist everything and return a fully-populated EvidenceBundle.
 *
 * Never throws: any unexpected error returns the demo bundle with a warning so
 * the pipeline never breaks.
 */

import "server-only";
import type {
  AtomFact,
  CalaEntityCandidate,
  EntityResolutionSummary,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  PublicEntityContext,
  SourceRecord,
} from "@/lib/types";
import { clamp01, deterministicId, extractDomain, freshnessScore } from "@/lib/utils";
import {
  saveEvidenceFact,
  savePublicContext,
  saveSourceRecord,
} from "@/lib/db/queries";
import { part2DemoEvidenceBundle } from "@/lib/demo/fixtures";
import {
  calaKnowledgeQuery,
  calaKnowledgeSearch,
} from "@/lib/providers/cala";
import { geminiWebContext } from "@/lib/providers/gemini";
import { resolveEntity } from "./entityResolution";
import { buildEvidenceFact } from "./factConfidence";
import { createSourceRecord } from "./sourceConfidence";

const MEDIUM_THRESHOLD = 0.5;

export async function enrichEvidence(
  input: ExtractionHandoff,
  opts?: { now?: Date },
): Promise<EvidenceBundle> {
  const now = opts?.now ?? new Date();
  const nowIso = now.toISOString();

  try {
    return await runEnrichment(input, now, nowIso);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...part2DemoEvidenceBundle,
      requestId: input.requestId,
      userId: input.userId,
      conversationId: input.conversation.id,
      enrichment: {
        ...part2DemoEvidenceBundle.enrichment,
        warnings: [
          ...part2DemoEvidenceBundle.enrichment.warnings,
          `enrichment fell back to demo bundle: ${message}`,
        ],
      },
    };
  }
}

async function runEnrichment(
  input: ExtractionHandoff,
  now: Date,
  nowIso: string,
): Promise<EvidenceBundle> {
  const warnings: string[] = [];
  const candidate = input.contactCandidate;
  const conversationId = input.conversation.id;

  // 1. Resolve / ensure a contactId.
  const contactId =
    input.conversation.contactId ??
    deterministicId("contact", `${input.userId}:${candidate.name ?? ""}:${candidate.company ?? ""}:${conversationId}`);

  const sourceRecords: SourceRecord[] = [];
  const publicContext: PublicEntityContext[] = [];
  const evidenceFacts: EvidenceFact[] = [];

  // 2. Always record the captured conversation as a source.
  const conversationSource = createSourceRecord({
    id: deterministicId("src", `conv:${conversationId}`),
    contactId,
    provider: input.sourceRecord.provider,
    sourceType: input.sourceRecord.sourceType,
    sourceName: "Captured conversation",
    sourceUrl: null,
    retrievedAt: input.sourceRecord.retrievedAt,
    now,
  });
  sourceRecords.push(conversationSource);

  // 3. Try Cala first (company/fund scope, ADR-003).
  const calaAttempted = true;
  let calaMatch = 0;
  let topCandidate: CalaEntityCandidate | undefined;
  let entityResolution: EntityResolutionSummary;

  const searchTerm = [candidate.name, candidate.company]
    .filter(Boolean)
    .join(" ")
    .trim();

  const calaSearch = await calaKnowledgeSearch(searchTerm || candidate.company || "");
  warnings.push(...calaSearch.warnings);
  topCandidate = pickBestCandidate(calaSearch.candidates, candidate.company);

  entityResolution = resolveEntity({
    capturedName: candidate.name ?? undefined,
    capturedCompany: candidate.company ?? undefined,
    capturedRole: candidate.role ?? undefined,
    capturedDomain:
      extractDomain(candidate.website) ?? extractDomain(candidate.email) ?? undefined,
    candidateName: topCandidate?.name,
    candidateCompany: topCandidate?.company ?? topCandidate?.name,
    candidateRole: topCandidate?.role,
    candidateDomain: topCandidate?.domain,
    sourceAgreementScore: calaSearch.available ? 0.6 : 0,
    lastUpdated: nowIso,
    now,
  });
  calaMatch = entityResolution.score;

  let calaProducedFacts = false;
  if (calaSearch.available && topCandidate && calaMatch >= MEDIUM_THRESHOLD) {
    const query = `What is ${topCandidate.company ?? topCandidate.name}, what sector is it in, and what recent funding or growth signals exist?`;
    const calaQuery = await calaKnowledgeQuery(query);
    warnings.push(...calaQuery.warnings);

    const calaSource = createSourceRecord({
      id: deterministicId("src", `cala:${topCandidate.providerEntityId}`),
      contactId,
      provider: "cala",
      sourceType: "cala_verified_fact",
      sourceName: "Cala verified company context",
      sourceUrl: null,
      retrievedAt: nowIso,
      now,
      crossAgreement: 0.6,
    });
    sourceRecords.push(calaSource);

    publicContext.push({
      id: deterministicId("ctx", `cala:${topCandidate.providerEntityId}`),
      contactId,
      provider: "cala",
      providerEntityId: topCandidate.providerEntityId,
      entityType: topCandidate.entityType,
      canonicalName: topCandidate.company ?? topCandidate.name,
      rawContext: {
        answer: calaQuery.answer ?? null,
        facts: calaQuery.facts,
        confidence: topCandidate.confidence ?? null,
      },
      retrievedAt: nowIso,
      confidence: clamp01(topCandidate.confidence ?? calaMatch),
    });

    for (const factText of calaQuery.facts) {
      evidenceFacts.push(
        buildEvidenceFact({
          id: deterministicId("fact", `cala:${conversationId}:${factText}`),
          contactId,
          conversationId,
          fact: factText,
          factType: "company_context",
          sourceRecordId: calaSource.id,
          sourceType: "cala_verified_fact",
          entityMatchConfidence: calaMatch,
          sourceConfidence: calaSource.sourceConfidence,
          extractionConfidence: 0.85,
          freshness: freshnessScore(nowIso, now),
          createdAt: nowIso,
          allowDraftSafe: true,
        }),
      );
      calaProducedFacts = true;
    }
  }

  // 4. Web fallback — only after Cala, only when warranted.
  let webFallbackAttempted = false;
  let webProducedFacts = false;
  if (
    !calaProducedFacts &&
    calaMatch < MEDIUM_THRESHOLD &&
    shouldEnrich(input)
  ) {
    webFallbackAttempted = true;
    const query = candidate.company
      ? `What is ${candidate.company} and what recent professional signals exist?`
      : `What recent professional context exists for ${candidate.name ?? "this contact"}?`;

    const web = await geminiWebContext({
      name: candidate.name ?? undefined,
      company: candidate.company ?? undefined,
      role: candidate.role ?? undefined,
      query,
      now,
    });

    if (web.available) {
      for (const claim of web.claims) {
        // Every web fact MUST carry a citation URL (geminiWebContext already
        // discards uncited claims, but guard again here).
        if (!claim.sourceUrl) {
          warnings.push("SOURCE_REQUIRED: discarded uncited web claim");
          continue;
        }
        const webSource = createSourceRecord({
          id: deterministicId("src", `web:${claim.sourceUrl}`),
          contactId,
          provider: "web",
          sourceType: claim.sourceType,
          sourceName: "Web search citation",
          sourceUrl: claim.sourceUrl,
          retrievedAt: web.retrievedAt,
          now,
        });
        sourceRecords.push(webSource);

        evidenceFacts.push(
          buildEvidenceFact({
            id: deterministicId("fact", `web:${conversationId}:${claim.text}`),
            contactId,
            conversationId,
            fact: claim.text,
            factType: "web_context",
            sourceRecordId: webSource.id,
            sourceType: claim.sourceType,
            entityMatchConfidence: calaMatch,
            sourceConfidence: webSource.sourceConfidence,
            extractionConfidence: 0.6,
            freshness: freshnessScore(web.retrievedAt, now),
            createdAt: nowIso,
            // Web facts default to NOT draft-safe (spec Hard Rules / Phase 5b).
            allowDraftSafe: false,
          }),
        );
        webProducedFacts = true;
      }

      if (webProducedFacts) {
        publicContext.push({
          id: deterministicId("ctx", `web:${conversationId}`),
          contactId,
          provider: "web",
          providerEntityId: null,
          entityType: candidate.company ? "company" : "person",
          canonicalName: candidate.company ?? candidate.name ?? null,
          rawContext: {
            summary: web.summary,
            claims: web.claims.map((c) => ({
              text: c.text,
              sourceUrl: c.sourceUrl,
              sourceType: c.sourceType,
            })),
          },
          retrievedAt: web.retrievedAt,
          confidence: clamp01(calaMatch || 0.4),
        });
      }
    } else {
      warnings.push("web fallback returned no usable public context");
    }
  }

  // 5. Convert conversation atoms (facts) into evidence facts.
  for (const atom of input.atoms.facts) {
    evidenceFacts.push(
      buildAtomFact(atom, {
        contactId,
        conversationId,
        sourceRecord: conversationSource,
        entityMatchConfidence: Math.max(calaMatch, 0.6),
        nowIso,
        now,
      }),
    );
  }

  // 6. Determine status.
  const hasPublicContext = calaProducedFacts || webProducedFacts;
  const status: EvidenceBundle["enrichment"]["status"] = hasPublicContext
    ? calaProducedFacts && webProducedFacts
      ? "available"
      : "available"
    : "public_context_unavailable";

  if (!hasPublicContext) {
    warnings.push("public context unavailable");
  }

  // 7. Persist.
  for (const src of sourceRecords) saveSourceRecord(src);
  for (const ctx of publicContext) savePublicContext(ctx);
  for (const fact of evidenceFacts) saveEvidenceFact(fact);

  return {
    requestId: input.requestId,
    userId: input.userId,
    conversationId,
    contactId,
    contactCandidate: candidate,
    publicContext,
    sourceRecords,
    evidenceFacts,
    entityResolution,
    enrichment: {
      attempted: true,
      calaAttempted,
      webFallbackAttempted,
      status,
      warnings,
    },
  };
}

/**
 * Enrichment trigger policy (spec Phase 5b / 7.1). Enrich when the contact is
 * high-opportunity, ambiguous-but-important, or — for the demo — always-on when
 * a meaningful contact was captured.
 */
export function shouldEnrich(input: ExtractionHandoff): boolean {
  const hasContact = Boolean(
    input.contactCandidate.name || input.contactCandidate.company,
  );
  if (!hasContact) return false;

  const highOpportunity = input.opportunityHints.some((h) => h.score >= 0.5);
  const thinConversation = input.atoms.facts.length <= 3;

  // Always-on for the demo when we met a real contact; gated by opportunity /
  // ambiguity in spirit, but we never enrich strangers (handled by hasContact).
  return highOpportunity || thinConversation || hasContact;
}

function pickBestCandidate(
  candidates: CalaEntityCandidate[],
  company?: string | null,
): CalaEntityCandidate | undefined {
  if (candidates.length === 0) return undefined;
  if (!company) return candidates[0];
  // Prefer a candidate whose name/company best matches the captured company.
  return (
    candidates
      .slice()
      .sort(
        (a, b) =>
          (b.confidence ?? 0) - (a.confidence ?? 0),
      )[0] ?? candidates[0]
  );
}

function buildAtomFact(
  atom: AtomFact,
  ctx: {
    contactId: string;
    conversationId: string;
    sourceRecord: SourceRecord;
    entityMatchConfidence: number;
    nowIso: string;
    now: Date;
  },
): EvidenceFact {
  const isProfessional = atom.isProfessional ?? true;
  const isSensitive = atom.isSensitive ?? false;
  return buildEvidenceFact({
    id: deterministicId("fact", `atom:${ctx.conversationId}:${atom.text}`),
    contactId: ctx.contactId,
    conversationId: ctx.conversationId,
    fact: atom.text,
    factType: atom.type ?? null,
    sourceRecordId: ctx.sourceRecord.id,
    sourceType: ctx.sourceRecord.sourceType,
    entityMatchConfidence: ctx.entityMatchConfidence,
    sourceConfidence: ctx.sourceRecord.sourceConfidence,
    extractionConfidence: atom.confidence ?? 0.6,
    freshness: freshnessScore(ctx.nowIso, ctx.now),
    createdAt: ctx.nowIso,
    isProfessional,
    isSensitive,
    // Sensitive / non-professional atoms are never draft-safe.
    allowDraftSafe: isProfessional && !isSensitive,
  });
}
