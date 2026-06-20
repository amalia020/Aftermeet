/**
 * Phase 13 — Opportunity priority score.
 *
 * Combines goal fit, contact POV fit, stakes, urgency decay, explicit
 * commitment, fact confidence, and relationship strength, minus recipient
 * burden and uncertainty penalties. Implements the spec formula exactly and
 * clamps the result to [0, 1].
 *
 * Pure and deterministic.
 */

import { clamp01 } from "@/lib/utils";

export function opportunityPriority(input: {
  userGoalFit: number;
  contactPovFit: number;
  stakes: number;
  urgencyDecay: number;
  explicitCommitment: number;
  factConfidence: number;
  relationshipStrength: number;
  recipientBurden: number;
  uncertaintyPenalty: number;
}): number {
  const priority =
    0.25 * input.userGoalFit +
    0.2 * input.contactPovFit +
    0.15 * input.stakes +
    0.15 * input.urgencyDecay +
    0.1 * input.explicitCommitment +
    0.1 * input.factConfidence +
    0.05 * input.relationshipStrength -
    0.15 * input.recipientBurden -
    0.1 * input.uncertaintyPenalty;

  return clamp01(priority);
}
