"use client";

/**
 * ConfidenceBreakdown (Part 4) — shows the factors behind the final confidence
 * so the decision is legible, not a black box. recipientBurden is shown as a
 * "low burden is good" inverse meter.
 */

import type { DecisionTrace } from "@/lib/types";
import { ScoreBar } from "./primitives";

export interface ConfidenceBreakdownProps {
  breakdown: DecisionTrace["confidenceBreakdown"];
}

const ROWS: {
  key: keyof DecisionTrace["confidenceBreakdown"];
  label: string;
  invert?: boolean;
}[] = [
  { key: "entityMatch", label: "Identity match" },
  { key: "sourceConfidence", label: "Source quality" },
  { key: "factConfidence", label: "Fact confidence" },
  { key: "userGoalFit", label: "Fit to your goal" },
  { key: "contactPovFit", label: "Value for them" },
  { key: "recipientBurden", label: "Recipient burden", invert: true },
];

function toneFor(value: number): "go" | "calm" | "warm" | "stop" {
  if (value >= 0.7) return "go";
  if (value >= 0.5) return "calm";
  if (value >= 0.3) return "warm";
  return "stop";
}

export function ConfidenceBreakdown({ breakdown }: ConfidenceBreakdownProps) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-cloud-dim">Overall confidence</span>
        <span className="font-mono text-2xl text-cloud">
          {(breakdown.finalConfidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="space-y-3">
        {ROWS.map((row) => {
          const raw = breakdown[row.key];
          // For burden, lower is better, so the displayed "goodness" is inverted.
          const display = row.invert ? 1 - raw : raw;
          return (
            <div key={row.key}>
              <ScoreBar
                value={display}
                tone={toneFor(display)}
                label={row.invert ? `${row.label} (lower is better)` : row.label}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
