"use client";

/**
 * WarmthDecayBar (Part 4) — a calm meter showing how warm a relationship still
 * is. Higher = fresher. This is NOT a grade of the person; it is a decay signal
 * for the conversation. A rare warning is only surfaced when the caller passes
 * `warning` (stakes + staleness justify it).
 */

import { formatWarmth, warmthLabel, warmthBand } from "@/lib/frontend/formatting";

export interface WarmthDecayBarProps {
  warmth: number;
  warning?: boolean;
  warningReason?: string;
  compact?: boolean;
}

export function WarmthDecayBar({
  warmth,
  warning,
  warningReason,
  compact,
}: WarmthDecayBarProps) {
  const pct = Math.max(0, Math.min(1, warmth)) * 100;
  const band = warmthBand(warmth);
  const barColor =
    band === "fresh"
      ? "bg-signal-go"
      : band === "cooling"
        ? "bg-signal-warm"
        : "bg-cloud-faint";

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-cloud-dim">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${barColor}`} aria-hidden />
          {warmthLabel(warmth)}
        </span>
        {!compact ? (
          <span className="font-mono text-cloud-faint">{formatWarmth(warmth)}</span>
        ) : null}
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-ink-line"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Conversation warmth"
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {warning ? (
        <p className="mt-1.5 rounded border border-signal-warm/30 bg-signal-warm/10 px-2 py-1 text-[11px] text-signal-warm">
          {warningReason ?? "This one is worth a look before it goes cold."}
        </p>
      ) : null}
    </div>
  );
}
