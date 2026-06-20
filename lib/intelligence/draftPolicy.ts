/**
 * Phase 15 — Draft permission gate.
 *
 * Filters evidence facts down to only those that are safe to use in a generated
 * draft. Exact filter per spec: high fact confidence, professional, not
 * sensitive, and from a known source type.
 *
 * Pure and deterministic.
 */

import type { EvidenceFact } from "@/lib/types";

export function factsAllowedInDraft(facts: EvidenceFact[]): EvidenceFact[] {
  return facts.filter(
    (fact) =>
      fact.factConfidence >= 0.75 &&
      fact.isProfessional === true &&
      fact.isSensitive !== true &&
      fact.sourceType !== "unknown",
  );
}
