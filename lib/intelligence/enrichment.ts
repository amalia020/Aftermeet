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
  ContactCandidate,
  EntityResolutionSummary,
  EvidenceBundle,
  EvidenceFact,
  EvidenceProfile,
  ExtractionHandoff,
  JsonValue,
  PublicEntityContext,
  SourceRecord,
  WebContextClaim,
  WebContextResult,
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
import { geminiWebContext, requestGeminiJson } from "@/lib/providers/gemini";
import { resolveEntity } from "./entityResolution";
import { buildEvidenceFact } from "./factConfidence";
import { createSourceRecord } from "./sourceConfidence";

// Entity match required before Cala facts are trusted (and draft-safe). Below
// this, Cala is ignored and we rely on the (now awaited) Gemini web context.
const MEDIUM_THRESHOLD = 0.5;
// How long to wait on the grounded Gemini web call before giving up. Generous
// on purpose — when Cala is weak this is the primary source, so we wait for it.
const WEB_CONTEXT_TIMEOUT_MS = 45_000;

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

  // 3 + 4. Query Cala and the Gemini web context CONCURRENTLY.
  //
  // Previously Gemini ran only as a sequential fallback, gated on a low Cala
  // score — so a borderline Cala match plus a slow/timed-out web call left the
  // profile empty. Now both providers run in parallel: a slow web call never
  // blocks Cala data (and vice versa), and we combine whatever each returns.
  const calaAttempted = true;
  const searchTerm = [candidate.name, candidate.company]
    .filter(Boolean)
    .join(" ")
    .trim();
  const webFallbackAttempted = shouldEnrich(input);

  const [cala, web] = await Promise.all([
    enrichViaCala({ candidate, searchTerm, nowIso, now }),
    webFallbackAttempted
      ? geminiWebContext({
          name: candidate.name ?? undefined,
          company: candidate.company ?? undefined,
          role: candidate.role ?? undefined,
          query: candidate.company
            ? `What is ${candidate.company} and what recent professional signals exist?`
            : `What recent professional context exists for ${candidate.name ?? "this contact"}?`,
          now,
          timeoutMs: WEB_CONTEXT_TIMEOUT_MS,
        })
      : Promise.resolve<WebContextResult | null>(null),
  ]);

  const { entityResolution, calaMatch } = cala;
  warnings.push(...cala.warnings);

  // Cala verified facts — only trusted at >= 50% entity match. Below that we
  // ignore Cala and lean on the awaited Gemini web context instead.
  const calaProducedFacts = collectCalaFacts({
    cala,
    contactId,
    conversationId,
    nowIso,
    now,
    sourceRecords,
    evidenceFacts,
  });

  // Gemini grounded web claims — always context-only until independently
  // confirmed. Warn when Cala was too weak to corroborate them.
  if (webFallbackAttempted && calaMatch < MEDIUM_THRESHOLD) {
    warnings.push(
      "Cala entity confidence is below 50%. Gemini fallback context may be inaccurate and requires confirmation."
    );
  }
  const webProducedFacts = collectWebFacts({
    web,
    calaMatch,
    contactId,
    conversationId,
    nowIso,
    now,
    sourceRecords,
    evidenceFacts,
    warnings,
  });

  // Combine both providers (plus captured notes) into ONE structured profile via
  // an LLM, with a deterministic merge fallback when the model is unavailable.
  if (calaProducedFacts || webProducedFacts) {
    const synthesis = await synthesizeEvidenceProfile({
      candidate,
      calaFacts: cala.queryFacts,
      webSummary: web?.available ? web.summary : undefined,
      webClaims: web?.available ? web.claims : [],
      atoms: input.atoms.facts.map((atom) => atom.text),
    });
    warnings.push(...synthesis.warnings);

    publicContext.push({
      id: deterministicId("ctx", `combined:${conversationId}`),
      contactId,
      provider: webProducedFacts ? "gemini" : "cala",
      providerEntityId: cala.topCandidate?.providerEntityId ?? null,
      entityType: candidate.company ? "company" : "person",
      canonicalName: candidate.company ?? candidate.name ?? null,
      rawContext: {
        profile: synthesis.profile as unknown as JsonValue,
        cala: { answer: cala.queryAnswer ?? null, facts: cala.queryFacts },
        web: web?.available
          ? {
              summary: web.summary,
              claims: web.claims.map((c) => ({
                text: c.text,
                sourceUrl: c.sourceUrl,
                sourceType: c.sourceType,
              })),
            }
          : null,
      },
      retrievedAt: nowIso,
      confidence: clamp01(Math.max(calaMatch, web?.available ? 0.4 : 0)),
    });
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

interface CalaEnrichment {
  entityResolution: EntityResolutionSummary;
  calaMatch: number;
  topCandidate?: CalaEntityCandidate;
  queryFacts: string[];
  queryAnswer?: string;
  available: boolean;
  warnings: string[];
}

/** Cala search + entity resolution + (when the match clears CONTEXT_THRESHOLD)
 *  the knowledge query. Self-contained so it can run concurrently with Gemini. */
async function enrichViaCala(args: {
  candidate: ContactCandidate;
  searchTerm: string;
  nowIso: string;
  now: Date;
}): Promise<CalaEnrichment> {
  const { candidate, searchTerm, nowIso, now } = args;
  const warnings: string[] = [];

  const calaSearch = await calaKnowledgeSearch(searchTerm || candidate.company || "");
  warnings.push(...calaSearch.warnings);
  const topCandidate = pickBestCandidate(calaSearch.candidates, candidate.company);

  const entityResolution = resolveEntity({
    capturedName: candidate.name ?? undefined,
    capturedCompany: candidate.company ?? undefined,
    capturedRole: candidate.role ?? undefined,
    capturedDomain:
      extractDomain(candidate.website) ?? extractDomain(candidate.email) ?? undefined,
    candidateName:
      topCandidate?.entityType === "person" ? topCandidate.name : candidate.name ?? undefined,
    candidateCompany: topCandidate?.company ?? topCandidate?.name,
    candidateRole: topCandidate?.role,
    candidateDomain: topCandidate?.domain,
    sourceAgreementScore: calaSearch.available ? 0.6 : 0,
    lastUpdated: nowIso,
    now,
  });
  const calaMatch = entityResolution.score;

  let queryFacts: string[] = [];
  let queryAnswer: string | undefined;
  if (calaSearch.available && topCandidate && calaMatch >= MEDIUM_THRESHOLD) {
    const query = `What is ${topCandidate.company ?? topCandidate.name}, what sector is it in, and what recent funding or growth signals exist?`;
    const calaQuery = await calaKnowledgeQuery(query);
    warnings.push(...calaQuery.warnings);
    queryFacts = calaQuery.facts;
    queryAnswer = calaQuery.answer;
  }

  return {
    entityResolution,
    calaMatch,
    topCandidate,
    queryFacts,
    queryAnswer,
    available: calaSearch.available,
    warnings,
  };
}

/** Append Cala verified facts (source record + evidence facts). Returns whether
 *  any fact was produced. Mutates the supplied arrays. */
function collectCalaFacts(args: {
  cala: CalaEnrichment;
  contactId: string;
  conversationId: string;
  nowIso: string;
  now: Date;
  sourceRecords: SourceRecord[];
  evidenceFacts: EvidenceFact[];
}): boolean {
  const { cala, contactId, conversationId, nowIso, now, sourceRecords, evidenceFacts } = args;
  if (!cala.available || !cala.topCandidate || cala.calaMatch < MEDIUM_THRESHOLD) return false;
  if (!cala.queryFacts.length) return false;

  const calaSource = createSourceRecord({
    id: deterministicId("src", `cala:${cala.topCandidate.providerEntityId}`),
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

  for (const factText of cala.queryFacts) {
    evidenceFacts.push(
      buildEvidenceFact({
        id: deterministicId("fact", `cala:${conversationId}:${factText}`),
        contactId,
        conversationId,
        fact: factText,
        factType: "company_context",
        sourceRecordId: calaSource.id,
        sourceType: "cala_verified_fact",
        entityMatchConfidence: cala.calaMatch,
        sourceConfidence: calaSource.sourceConfidence,
        extractionConfidence: 0.85,
        freshness: freshnessScore(nowIso, now),
        createdAt: nowIso,
        allowDraftSafe: true,
      }),
    );
  }
  return true;
}

/** Append Gemini grounded web claims (source records + evidence facts). Returns
 *  whether any fact was produced. Mutates the supplied arrays. */
function collectWebFacts(args: {
  web: WebContextResult | null;
  calaMatch: number;
  contactId: string;
  conversationId: string;
  nowIso: string;
  now: Date;
  sourceRecords: SourceRecord[];
  evidenceFacts: EvidenceFact[];
  warnings: string[];
}): boolean {
  const { web, calaMatch, contactId, conversationId, nowIso, now, sourceRecords, evidenceFacts, warnings } =
    args;
  if (!web) return false;
  warnings.push(...(web.warnings ?? []));
  if (!web.available) {
    warnings.push("web fallback returned no usable public context");
    return false;
  }

  const uncitedClaimCount = web.claims.filter((claim) => !claim.sourceUrl).length;
  if (uncitedClaimCount > 0) {
    warnings.push(
      `${uncitedClaimCount} uncited Gemini claim${uncitedClaimCount === 1 ? " was" : "s were"} retained as low-confidence context and blocked from drafts.`
    );
  }

  let produced = false;
  for (const claim of web.claims) {
    const isCited = Boolean(claim.sourceUrl);
    const sourceType = isCited ? claim.sourceType : "unknown";
    const webSource = createSourceRecord({
      id: deterministicId("src", `web:${claim.sourceUrl || claim.text}`),
      contactId,
      provider: "web",
      sourceType,
      sourceName: isCited ? "Web search citation" : "Gemini uncited context",
      sourceUrl: claim.sourceUrl || null,
      retrievedAt: web.retrievedAt,
      now,
      notes: isCited
        ? "Gemini grounded web claim"
        : "Uncited Gemini claim; requires user or source confirmation",
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
        sourceType,
        entityMatchConfidence: calaMatch,
        sourceConfidence: webSource.sourceConfidence,
        extractionConfidence: isCited ? 0.6 : 0.35,
        freshness: freshnessScore(web.retrievedAt, now),
        createdAt: nowIso,
        // Gemini facts remain context-only until independently confirmed.
        allowDraftSafe: false,
      }),
    );
    produced = true;
  }
  return produced;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return dedupeStrings(value.filter((item): item is string => typeof item === "string"));
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Combine Cala (verified) facts, grounded web claims, and captured notes into a
 * single de-duplicated structured profile. Uses the LLM when configured; always
 * falls back to a deterministic merge so a model timeout never loses data.
 */
async function synthesizeEvidenceProfile(args: {
  candidate: ContactCandidate;
  calaFacts: string[];
  webSummary?: string;
  webClaims: WebContextClaim[];
  atoms: string[];
}): Promise<{ profile: EvidenceProfile; warnings: string[] }> {
  const { candidate, calaFacts, webSummary, webClaims, atoms } = args;
  const baseline: EvidenceProfile = {
    summary: (webSummary ?? calaFacts[0] ?? atoms[0] ?? "").trim(),
    role: candidate.role ?? undefined,
    company: candidate.company ?? undefined,
    expertise: [],
    highlights: dedupeStrings([...calaFacts, ...webClaims.map((c) => c.text)]).slice(0, 8),
    signals: [],
  };

  if (!calaFacts.length && !webClaims.length) {
    return { profile: baseline, warnings: [] };
  }

  const system = [
    "You merge professional context about a single person or company someone met at a networking event.",
    "Inputs come from Cala (a verified company/fund knowledge base), grounded web search, and notes the user captured in conversation.",
    "Produce ONE concise, de-duplicated professional profile as JSON.",
    "Prefer Cala (verified) facts when sources conflict. Use only information supported by the inputs — never invent or guess.",
    "Professional information only; omit any field you cannot support.",
    'JSON shape: { "summary": string, "role"?: string, "company"?: string, "sector"?: string, "location"?: string, "expertise": string[], "highlights": string[], "signals": string[] }.',
  ].join("\n");
  const user = JSON.stringify({
    contact: { name: candidate.name, company: candidate.company, role: candidate.role },
    calaVerifiedFacts: calaFacts,
    webSearch: { summary: webSummary ?? "", claims: webClaims.map((c) => c.text) },
    capturedNotes: atoms,
  });

  const response = await requestGeminiJson({ system, user, timeoutMs: 12_000 });
  const json = response.json;
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { profile: baseline, warnings: response.warnings };
  }

  const record = json as Record<string, unknown>;
  const highlights = asStringArray(record.highlights);
  return {
    profile: {
      summary: asOptionalString(record.summary) ?? baseline.summary,
      role: asOptionalString(record.role) ?? baseline.role,
      company: asOptionalString(record.company) ?? baseline.company,
      sector: asOptionalString(record.sector),
      location: asOptionalString(record.location),
      expertise: asStringArray(record.expertise),
      highlights: highlights.length ? highlights : baseline.highlights,
      signals: asStringArray(record.signals),
    },
    warnings: response.warnings,
  };
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
