/**
 * Small presentation formatters (Part 4).
 *
 * Pure functions only — no React, no API, no backend imports. These convert raw
 * scores and timestamps into the calm, legible strings the UI shows. The action /
 * goal / route humanizers live in viewModels.ts and are re-exported here so
 * components have a single formatting import.
 */

export {
  humanizeAction,
  humanizeGoal,
  humanizeRouteType,
} from "./viewModels";

/** Clamp a 0..1 score and render it as a whole-number percent string. */
export function formatPercent(value: number, fractionDigits = 0): string {
  const clamped = Math.max(0, Math.min(1, value));
  return `${(clamped * 100).toFixed(fractionDigits)}%`;
}

/** Warmth as a calm percent (used by warmth/decay meters). */
export function formatWarmth(warmth: number): string {
  return formatPercent(warmth);
}

export type WarmthBand = "fresh" | "cooling" | "cold";

/** Bucket a warmth score into a calm, non-alarming band. */
export function warmthBand(warmth: number): WarmthBand {
  if (warmth >= 0.6) return "fresh";
  if (warmth >= 0.35) return "cooling";
  return "cold";
}

export function warmthLabel(warmth: number): string {
  switch (warmthBand(warmth)) {
    case "fresh":
      return "Fresh";
    case "cooling":
      return "Cooling";
    default:
      return "Going cold";
  }
}

/** A human label for a 0..1 confidence score. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High confidence";
  if (confidence >= 0.6) return "Moderate confidence";
  if (confidence >= 0.4) return "Low confidence";
  return "Very low confidence";
}

/** Tone hint (matches the signal palette) for a 0..1 score. */
export function scoreTone(value: number): "go" | "calm" | "warm" | "stop" {
  if (value >= 0.7) return "go";
  if (value >= 0.5) return "calm";
  if (value >= 0.3) return "warm";
  return "stop";
}

/** A short, calm relative-time string ("just now", "3d ago"). */
export function relativeTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = now - then;
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (abs < minute) return "just now";
  let value: number;
  let unit: string;
  if (abs < hour) {
    value = Math.round(abs / minute);
    unit = "m";
  } else if (abs < day) {
    value = Math.round(abs / hour);
    unit = "h";
  } else if (abs < week) {
    value = Math.round(abs / day);
    unit = "d";
  } else {
    value = Math.round(abs / week);
    unit = "w";
  }
  return future ? `in ${value}${unit}` : `${value}${unit} ago`;
}

/** Format an optional money value as a compact USD string. */
export function formatMoney(value?: number | null): string {
  if (value == null) return "—";
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value}`;
}
