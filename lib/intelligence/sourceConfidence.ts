import type { SourceRecord, SourceType } from "@/lib/types";
import { clamp01, freshnessScore, roundScore } from "@/lib/intelligence/utils";

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
  manual: 0.7,
  unknown: 0.2
};

export function sourcePrior(sourceType: SourceType): number {
  return SOURCE_PRIORS[sourceType] ?? SOURCE_PRIORS.unknown;
}

export function provenanceScore(source: Pick<SourceRecord, "provider" | "sourceType" | "sourceUrl">): number {
  if (source.provider === "conversation" || source.provider === "business_card") return 0.9;
  if (source.sourceUrl && source.sourceType !== "search_snippet") return 0.9;
  if (source.sourceUrl) return 0.65;
  if (source.provider === "manual") return 0.55;
  return 0.25;
}

export function crossSourceAgreement(source: Pick<SourceRecord, "sourceType">): number {
  if (source.sourceType === "cala_verified_fact") return 0.85;
  if (source.sourceType === "company_website" || source.sourceType === "official_press") return 0.75;
  if (source.sourceType === "business_card" || source.sourceType === "user_voice_note") return 0.7;
  if (source.sourceType === "search_snippet") return 0.4;
  return 0.5;
}

export function sourceConfidence(source: SourceRecord): number {
  return roundScore(
    clamp01(
      0.45 * sourcePrior(source.sourceType) +
        0.2 * freshnessScore(source.retrievedAt) +
        0.2 * provenanceScore(source) +
        0.15 * crossSourceAgreement(source)
    )
  );
}

export function createSourceRecord(input: {
  provider: SourceRecord["provider"];
  sourceType: SourceRecord["sourceType"];
  contactId?: SourceRecord["contactId"];
  sourceName?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string;
  notes?: string | null;
}): SourceRecord {
  const source: SourceRecord = {
    id: `src_${crypto.randomUUID()}`,
    contactId: input.contactId ?? null,
    provider: input.provider,
    sourceType: input.sourceType,
    sourceName: input.sourceName ?? null,
    sourceUrl: input.sourceUrl ?? null,
    retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    sourceConfidence: 0,
    notes: input.notes ?? null
  };
  return {
    ...source,
    sourceConfidence: sourceConfidence(source)
  };
}
