/**
 * Phase 8 — Fact confidence and draft safety.
 *
 * Deterministic per-fact confidence as the product of its confidence inputs,
 * plus the safety classification that gates draft usage. "Confidence is
 * computed, not believed." Pure, no I/O.
 */

import type { EvidenceFact, SourceType } from "@/lib/types";
import { clamp01 } from "@/lib/utils";

export type FactSafety =
  | "safe_for_draft"
  | "scoring_only"
  | "needs_confirmation";

/**
 * Deterministic fact confidence (spec Phase 8):
 *
 *   sourceConfidence * entityMatchConfidence * extractionConfidence
 *     * freshness * (1 - contradictionPenalty)
 *
 * Accepts a partial so it can be called before the `factConfidence` field
 * itself is populated.
 */
export function factConfidence(
  fact: Pick<
    EvidenceFact,
    | "sourceConfidence"
    | "entityMatchConfidence"
    | "extractionConfidence"
    | "freshness"
    | "contradictionPenalty"
  >,
): number {
  return clamp01(
    fact.sourceConfidence *
      fact.entityMatchConfidence *
      fact.extractionConfidence *
      fact.freshness *
      (1 - clamp01(fact.contradictionPenalty)),
  );
}

/**
 * Safety classification (spec Phase 8 thresholds):
 *   >= 0.75 -> safe for draft
 *   0.45..0.75 -> safe for internal scoring, phrase carefully
 *   < 0.45 -> do not use unless the user confirms
 */
export function factSafety(confidence: number): FactSafety {
  if (confidence >= 0.75) return "safe_for_draft";
  if (confidence >= 0.45) return "scoring_only";
  return "needs_confirmation";
}

export interface BuildEvidenceFactInput {
  id: string;
  contactId?: string | null;
  conversationId: string;
  fact: string;
  factType?: string | null;
  sourceRecordId?: string | null;
  sourceType: SourceType;
  entityMatchConfidence: number;
  sourceConfidence: number;
  extractionConfidence: number;
  freshness: number;
  contradictionPenalty?: number;
  isProfessional?: boolean;
  isSensitive?: boolean;
  createdAt: string;
  /**
   * Web-derived facts default to NOT draft-safe regardless of score unless this
   * is set true (spec Phase 5b / Hard Rules). Cala/conversation facts may be
   * draft-safe purely on confidence.
   */
  allowDraftSafe?: boolean;
}

/**
 * Assemble a fully-typed EvidenceFact, computing factConfidence and safeForDraft
 * deterministically. A fact is only draft-safe when:
 *   - confidence clears the 0.75 threshold, AND
 *   - it is professional and non-sensitive, AND
 *   - draft-safety is allowed for its provenance (web defaults off).
 */
export function buildEvidenceFact(input: BuildEvidenceFactInput): EvidenceFact {
  const contradictionPenalty = clamp01(input.contradictionPenalty ?? 0);
  const isProfessional = input.isProfessional ?? true;
  const isSensitive = input.isSensitive ?? false;
  const allowDraftSafe = input.allowDraftSafe ?? true;

  const confidence = factConfidence({
    sourceConfidence: clamp01(input.sourceConfidence),
    entityMatchConfidence: clamp01(input.entityMatchConfidence),
    extractionConfidence: clamp01(input.extractionConfidence),
    freshness: clamp01(input.freshness),
    contradictionPenalty,
  });

  const safeForDraft =
    allowDraftSafe &&
    isProfessional &&
    !isSensitive &&
    factSafety(confidence) === "safe_for_draft";

  return {
    id: input.id,
    contactId: input.contactId ?? null,
    conversationId: input.conversationId,
    fact: input.fact,
    factType: input.factType ?? null,
    sourceRecordId: input.sourceRecordId ?? null,
    sourceType: input.sourceType,
    entityMatchConfidence: clamp01(input.entityMatchConfidence),
    sourceConfidence: clamp01(input.sourceConfidence),
    extractionConfidence: clamp01(input.extractionConfidence),
    freshness: clamp01(input.freshness),
    contradictionPenalty,
    factConfidence: confidence,
    safeForDraft,
    isProfessional,
    isSensitive,
    createdAt: input.createdAt,
  };
}
