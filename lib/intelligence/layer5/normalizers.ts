import type { ScoreFeature, ScoreFeatureSource } from "@/lib/types";
import { clamp01, roundScore } from "@/lib/intelligence/utils";

export function normalizeEnumScore<T extends string>(
  table: Partial<Record<T, number>>,
  value: T,
  fallback: number
): number {
  return roundScore(clamp01(table[value] ?? fallback));
}

export function scoreFeature(input: {
  key: string;
  source: ScoreFeatureSource;
  rawValue: ScoreFeature["rawValue"];
  normalizedValue: number;
  confidence: number;
  reason: string;
}): ScoreFeature {
  return {
    key: input.key,
    source: input.source,
    rawValue: input.rawValue,
    normalizedValue: roundScore(input.normalizedValue),
    confidence: roundScore(input.confidence),
    reason: input.reason
  };
}

export function daysBetween(from: string | null | undefined, to: string): number {
  if (!from) return 30;
  const left = new Date(from).getTime();
  const right = new Date(to).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return 30;
  return Math.max(0, (right - left) / 86_400_000);
}
