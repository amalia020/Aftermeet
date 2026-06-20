"use client";

/**
 * OpportunityMatrix (Part 4) — the coverage mix for the active objective. Shows
 * which opportunity types you are actually meeting, weighted by average score,
 * plus the coverage gaps relative to your goals. Adapts to ANY objective — it is
 * never "founder" by default.
 */

import type { OpportunityTerminalViewModel } from "@/lib/types";
import { humanizeRouteType } from "@/lib/frontend/viewModels";
import { ScoreBar, EmptyState } from "./primitives";

export interface OpportunityMatrixProps {
  opportunityMix: OpportunityTerminalViewModel["opportunityMix"];
  coverageGaps: string[];
}

export function OpportunityMatrix({ opportunityMix, coverageGaps }: OpportunityMatrixProps) {
  if (!opportunityMix.length) {
    return (
      <EmptyState
        title="No opportunities mapped yet"
        body="Capture a few conversations and the mix of opportunity types you meet will appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {opportunityMix.map((row) => (
          <div key={row.route}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-cloud">{humanizeRouteType(row.route)}</span>
              <span className="text-cloud-faint">
                <span className="font-mono text-cloud-dim">{row.count}</span> captured ·{" "}
                <span className="font-mono text-cloud-dim">
                  {(row.averageScore * 100).toFixed(0)}
                </span>{" "}
                avg fit
              </span>
            </div>
            <ScoreBar
              value={row.averageScore}
              tone={row.averageScore >= 0.6 ? "go" : row.averageScore >= 0.35 ? "calm" : "neutral"}
            />
          </div>
        ))}
      </div>

      {coverageGaps.length ? (
        <div className="rounded-lg border border-signal-warm/25 bg-signal-warm/5 p-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-signal-warm/80">
            Coverage gaps
          </p>
          <ul className="space-y-1 text-xs text-cloud-dim">
            {coverageGaps.map((gap, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-signal-warm" aria-hidden>
                  ◦
                </span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-cloud-faint">
          Your captured conversations cover every goal in your mission.
        </p>
      )}
    </div>
  );
}
