"use client";

/**
 * FiveForksView (Part 4) — the multi-route opportunity visualization. Every route
 * the engine considered is shown with its score, why, and whyNot, so the user can
 * see the road not taken. The chosen route is highlighted.
 */

import type { OpportunityRoute } from "@/lib/types";
import { humanizeRouteType } from "@/lib/frontend/viewModels";
import { ScoreBar, Pill } from "./primitives";

export interface FiveForksViewProps {
  routes: OpportunityRoute[];
  chosenRouteId?: string;
  chosenType?: OpportunityRoute["type"];
}

function isChosen(
  route: OpportunityRoute,
  chosenRouteId?: string,
  chosenType?: OpportunityRoute["type"],
): boolean {
  if (chosenRouteId && route.id) return route.id === chosenRouteId;
  return route.type === chosenType;
}

export function FiveForksView({ routes, chosenRouteId, chosenType }: FiveForksViewProps) {
  const sorted = [...routes].sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-3">
      {sorted.map((route, i) => {
        const chosen = isChosen(route, chosenRouteId, chosenType);
        return (
          <div
            key={route.id ?? `${route.type}-${i}`}
            className={[
              "rounded-lg border p-4 transition",
              chosen
                ? "border-signal-go/50 bg-signal-go/5"
                : "border-ink-line bg-ink-soft/30",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-cloud">
                  {humanizeRouteType(route.type)}
                </span>
                {chosen ? <Pill tone="go">Chosen route</Pill> : null}
              </div>
              <span className="font-mono text-sm text-cloud-dim">
                {(route.score * 100).toFixed(0)}
              </span>
            </div>

            <ScoreBar value={route.score} tone={chosen ? "go" : "neutral"} />

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {route.why.length ? (
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-signal-go/80">Why</p>
                  <ul className="space-y-1 text-xs text-cloud-dim">
                    {route.why.map((w, j) => (
                      <li key={j} className="flex gap-1.5">
                        <span className="text-signal-go" aria-hidden>+</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {route.whyNot.length ? (
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-cloud-faint">
                    Why not
                  </p>
                  <ul className="space-y-1 text-xs text-cloud-faint">
                    {route.whyNot.map((w, j) => (
                      <li key={j} className="flex gap-1.5">
                        <span aria-hidden>−</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
