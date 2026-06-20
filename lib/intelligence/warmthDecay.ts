/**
 * Phase 12 — Warmth decay.
 *
 * Estimates whether a thread is going cold given the opportunity type, time
 * since the last relevant action, and the relationship status. Implements the
 * spec formula exactly: reply boosts urgency (1.5x), drafted boosts (1.2x), and
 * booked never flags (returns 0).
 *
 * Pure and deterministic.
 */

import { clamp01 } from "@/lib/utils";
import type { ContactStatus, OpportunityType } from "@/lib/types";

/** Base half-life (hours) per opportunity type, per spec. */
export const HALF_LIFE_HOURS: Record<OpportunityType, number> = {
  raise: 36,
  hire: 48,
  user: 72,
  partner: 96,
  mentor: 120,
  candidate: 48,
  customer: 72,
  sponsor: 72,
  job: 48,
  community: 96,
  other: 72,
};

export function warmthScore(input: {
  opportunityType: OpportunityType;
  hoursSinceLastAction: number;
  status: ContactStatus;
}): number {
  const halfLife = HALF_LIFE_HOURS[input.opportunityType] ?? 72;
  const hours = Math.max(0, input.hoursSinceLastAction);
  const base = Math.exp(-hours / halfLife);

  if (input.status === "reply") return clamp01(base * 1.5);
  if (input.status === "drafted") return clamp01(base * 1.2);
  if (input.status === "booked") return 0;

  return clamp01(base);
}
