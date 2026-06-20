/**
 * Phase 22 — Feedback learning.
 *
 * Computes conversion rates by opportunity type from recorded outcomes and a
 * small, capped scoring boost. The boost is intentionally tiny so a single data
 * point cannot overfit future rankings.
 *
 * Pure and deterministic.
 */

import { clamp01 } from "@/lib/utils";
import type { OpportunityType, OutcomeSummary } from "@/lib/types";

export interface ConversionRates {
  replyRate: number;
  bookingRate: number;
  paidRate: number;
  total: number;
}

/** Outcomes that count as a "sent" action denominator. */
const SENT_LIKE = new Set(["sent", "reply", "booked", "paid", "wtp"]);

/**
 * Conversion rates for a given opportunity type. Denominator is the number of
 * sent-like outcomes for that type; numerators count replies/bookings/paid.
 */
export function conversionRatesForType(
  opportunityType: OpportunityType,
  outcomes: OutcomeSummary[],
): ConversionRates {
  const forType = outcomes.filter((o) => o.opportunityType === opportunityType);
  const sentLike = forType.filter((o) => SENT_LIKE.has(o.outcomeType)).length;
  const denom = sentLike > 0 ? sentLike : forType.length;

  if (denom === 0) {
    return { replyRate: 0, bookingRate: 0, paidRate: 0, total: 0 };
  }

  const replies = forType.filter((o) => o.outcomeType === "reply").length;
  const booked = forType.filter((o) => o.outcomeType === "booked").length;
  const paid = forType.filter(
    (o) => o.outcomeType === "paid" || o.outcomeType === "wtp",
  ).length;

  return {
    replyRate: clamp01(replies / denom),
    bookingRate: clamp01(booked / denom),
    paidRate: clamp01(paid / denom),
    total: denom,
  };
}

/** Minimum outcome events before any boost is applied (avoids overfitting). */
export const MIN_OUTCOMES_FOR_BOOST = 3;

/**
 * Small, capped scoring boost from historical conversion for this type.
 *   boost = 0.05*replyRate + 0.10*bookingRate + 0.15*paidRate
 * Returns 0 until enough outcomes exist; capped at 0.15.
 */
export function feedbackBoost(input: {
  opportunityType: OpportunityType;
  outcomes: OutcomeSummary[];
}): number {
  const rates = conversionRatesForType(input.opportunityType, input.outcomes);
  if (rates.total < MIN_OUTCOMES_FOR_BOOST) return 0;
  const boost =
    0.05 * rates.replyRate + 0.1 * rates.bookingRate + 0.15 * rates.paidRate;
  return clamp01(Math.min(boost, 0.15));
}

/** Alias matching the spec's `outcomeBoost` naming. */
export const outcomeBoost = feedbackBoost;
