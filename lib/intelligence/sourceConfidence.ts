/**
 * Phase 6 — Source priors and deterministic source confidence.
 *
 * Pure, deterministic, dependency-free (beyond shared utils + types). No I/O,
 * no clock reads except the injected `now`. Safe to unit test directly.
 *
 * "Confidence is computed, not believed": every source record gets a confidence
 * derived from its type prior, freshness, provenance, and cross-source
 * agreement — never from an LLM's self-report.
 */

import type { SourceRecord, SourceType } from "@/lib/types";
import { clamp01, freshnessScore } from "@/lib/utils";

/**
 * Deterministic priors per source type (spec Phase 6). Structured/verified
 * sources rank high; anonymous search snippets and unknowns rank low.
 */
export const SOURCE_PRIORS: Record<SourceType, number> = {
  business_card: 0.88,
  user_voice_note: 0.72,
  company_website: 0.9,
  fund_website: 0.9,
  official_press: 0.88,
  reputable_news: 0.8,
  cala_verified_fact: 0.82,
  personal_website: 0.75,
  search_snippet: 0.45,
  user_confirmed: 0.98,
  manual: 0.7,
  unknown: 0.2,
};

/** Prior for a source type; unknown types fall back to the lowest prior. */
export function sourcePrior(sourceType: SourceType): number {
  return SOURCE_PRIORS[sourceType] ?? SOURCE_PRIORS.unknown;
}

/**
 * Provenance: do we know where this fact actually came from? A cited URL is the
 * strongest signal. Cala verified facts carry provenance even without a URL.
 * User voice notes and business cards are first-party, so they get a solid
 * middling provenance. Everything else with no URL is weak.
 */
function provenanceScore(source: SourceRecord): number {
  if (source.sourceUrl && source.sourceUrl.trim().length > 0) return 1;
  switch (source.sourceType) {
    case "cala_verified_fact":
      return 0.9;
    case "user_confirmed":
      return 1;
    case "business_card":
    case "user_voice_note":
    case "manual":
      return 0.7;
    default:
      return 0.3;
  }
}

/**
 * Cross-source agreement: how many independent sources corroborate this fact.
 * Callers that have computed agreement (e.g. the same claim from Cala + press)
 * can pass it through `source.notes` is not structured, so we accept an explicit
 * override param. Default is a neutral 0.5 (no corroboration evidence either
 * way) so a single source is neither rewarded nor punished here.
 */
function crossSourceAgreement(agreement?: number): number {
  if (agreement === undefined || Number.isNaN(agreement)) return 0.5;
  return clamp01(agreement);
}

/**
 * Deterministic source confidence (spec Phase 6):
 *
 *   0.45*prior + 0.20*freshness + 0.20*provenance + 0.15*crossSourceAgreement
 *
 * `now` is injected for determinism. `crossSourceAgreement` is an optional
 * override for callers that have corroboration evidence.
 */
export function sourceConfidence(
  source: SourceRecord,
  now: Date = new Date(),
  crossAgreement?: number,
): number {
  return clamp01(
    0.45 * sourcePrior(source.sourceType) +
      0.2 * freshnessScore(source.retrievedAt, now) +
      0.2 * provenanceScore(source) +
      0.15 * crossSourceAgreement(crossAgreement),
  );
}

/**
 * Infer a source type from a citation domain (spec Phase 5b / 6). Used when a
 * grounded web claim only gives us a URL. Heuristic and intentionally
 * conservative: anything we can't classify becomes a search snippet.
 */
export function sourceTypeFromDomain(url: string): SourceType {
  const lower = (url ?? "").toLowerCase();
  if (!lower) return "search_snippet";

  // Reputable news outlets (non-exhaustive but covers common demo cases).
  const newsDomains = [
    "techcrunch.com",
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "wsj.com",
    "nytimes.com",
    "theverge.com",
    "forbes.com",
    "businessinsider.com",
    "wired.com",
    "venturebeat.com",
    "axios.com",
  ];
  if (newsDomains.some((d) => lower.includes(d))) return "reputable_news";

  // Press releases / official announcements.
  if (
    lower.includes("prnewswire") ||
    lower.includes("businesswire") ||
    lower.includes("globenewswire") ||
    lower.includes("/press") ||
    lower.includes("/news/") ||
    lower.includes("press-release")
  ) {
    return "official_press";
  }

  // Investor / fund sites.
  if (
    lower.includes("ventures") ||
    lower.includes("capital") ||
    lower.includes("partners") ||
    lower.includes(".vc") ||
    lower.includes("fund")
  ) {
    return "fund_website";
  }

  // Personal sites / profiles.
  if (
    lower.includes("medium.com") ||
    lower.includes("substack.com") ||
    lower.includes("github.io") ||
    lower.includes("about.me") ||
    lower.includes("/blog/") ||
    lower.includes("personal")
  ) {
    return "personal_website";
  }

  // A bare company domain (https://acme.com, https://acme.ai) is a company site.
  // Distinguish from a deep search-result link by the absence of a long path.
  const match = lower.match(/^(?:https?:\/\/)?(?:www\.)?([^/\s]+)(\/[^\s]*)?$/);
  if (match) {
    const path = match[2] ?? "";
    const isShallow = path === "" || path === "/" || path.length < 12;
    if (isShallow) return "company_website";
  }

  return "search_snippet";
}

/**
 * Convenience constructor for a deterministic source record. Confidence is
 * computed, never passed in. Web facts MUST carry a sourceUrl (enforced by
 * callers, not here).
 */
export function createSourceRecord(input: {
  id?: string;
  contactId?: string | null;
  provider: SourceRecord["provider"];
  sourceType: SourceType;
  sourceName?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string;
  notes?: string | null;
  now?: Date;
  crossAgreement?: number;
}): SourceRecord {
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  const record: SourceRecord = {
    id: input.id ?? `src_${crypto.randomUUID()}`,
    contactId: input.contactId ?? null,
    provider: input.provider,
    sourceType: input.sourceType,
    sourceName: input.sourceName ?? null,
    sourceUrl: input.sourceUrl ?? null,
    retrievedAt,
    sourceConfidence: 0,
    notes: input.notes ?? null,
  };
  record.sourceConfidence = sourceConfidence(
    record,
    input.now ?? new Date(),
    input.crossAgreement,
  );
  return record;
}
