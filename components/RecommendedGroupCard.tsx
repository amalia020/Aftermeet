"use client";

/**
 * RecommendedGroupCard (Part 4) — the next cluster of people worth a batch of
 * attention, with why, a suggested (manual) action, the signal you'd expect, and
 * confidence. Calm framing: a suggestion, not a command.
 */

import type { ClusterRecommendation } from "@/lib/types";
import { Pill, ScoreBar } from "./primitives";

export interface RecommendedGroupCardProps {
  cluster: ClusterRecommendation;
}

export function RecommendedGroupCard({ cluster }: RecommendedGroupCardProps) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-cloud">{cluster.clusterName}</span>
        <Pill tone="calm">{(cluster.score * 100).toFixed(0)} fit</Pill>
      </div>

      <ScoreBar value={cluster.score} tone="calm" />

      {cluster.why.length ? (
        <ul className="mt-3 space-y-1 text-xs text-cloud-dim">
          {cluster.why.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-signal-calm" aria-hidden>
                +
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-md border border-ink-line bg-ink px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-cloud-faint">Suggested move</p>
          <p className="mt-0.5 text-cloud">{cluster.suggestedAction}</p>
        </div>
        <div className="rounded-md border border-ink-line bg-ink px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-cloud-faint">Expected signal</p>
          <p className="mt-0.5 text-cloud">{cluster.expectedSignal}</p>
        </div>
      </div>

      <p className="mt-2 text-right text-[11px] text-cloud-faint">
        confidence {(cluster.confidence * 100).toFixed(0)}%
      </p>
    </div>
  );
}
