/**
 * Phase 11 — Recipient burden.
 *
 * Estimates how costly, generic, or pushy an action would feel to the recipient.
 * High burden blocks otherwise high-priority outreach (see actionPolicy).
 *
 * The spec formula is expressed over penalty terms:
 *   burden = 0.30*genericness + 0.25*askSize + 0.20*weakContextPenalty
 *          + 0.15*lowMutualValuePenalty + 0.10*timingPenalty
 *
 * The public input expresses the *positive* signals (specificity, relationship
 * strength, mutual value, timing fit); we convert each to its penalty here.
 *
 * Pure and deterministic, clamped to [0, 1].
 */

import { clamp01 } from "@/lib/utils";

export function recipientBurden(input: {
  /** How specific/personalized the message is (1 = highly specific, 0 = generic). */
  messageSpecificity: number;
  /** How large the ask is (1 = big ask, 0 = trivial). Already a penalty term. */
  askSize: number;
  /** Existing relationship strength (1 = strong, 0 = cold stranger). */
  relationshipStrength: number;
  /** Mutual value of the action (1 = clearly valuable to recipient, 0 = one-sided). */
  mutualValue: number;
  /** Timing fit (1 = great moment, 0 = bad timing). */
  timingFit: number;
}): number {
  const genericness = clamp01(1 - input.messageSpecificity);
  const askSize = clamp01(input.askSize);
  const weakContextPenalty = clamp01(1 - input.relationshipStrength);
  const lowMutualValuePenalty = clamp01(1 - input.mutualValue);
  const timingPenalty = clamp01(1 - input.timingFit);

  const burden =
    0.3 * genericness +
    0.25 * askSize +
    0.2 * weakContextPenalty +
    0.15 * lowMutualValuePenalty +
    0.1 * timingPenalty;

  return clamp01(burden);
}
