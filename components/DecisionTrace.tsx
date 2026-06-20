"use client";

/**
 * DecisionTrace (Part 4) — THE magic moment. Renders the full chain from the
 * conversation to the chosen action and draft:
 *
 *   Conversation -> Facts -> Context -> Routes -> Decision -> Draft
 *
 * Built entirely from a RecommendationPackage (fixture- or API-backed). Designed
 * to be understandable in under ten seconds: a numbered cascade, then the chosen
 * action with why / why-not, confidence breakdown, the five forks, and the
 * editable, manual-send draft.
 */

import type { RecommendationPackage } from "@/lib/types";
import { humanizeAction } from "@/lib/frontend/viewModels";
import { Panel, Pill } from "./primitives";
import { ConfidenceBreakdown } from "./ConfidenceBreakdown";
import { FiveForksView } from "./FiveForksView";
import { DraftPreview } from "./DraftPreview";

export interface DecisionTraceProps {
  pkg: RecommendationPackage;
  onMarkSent?: () => void;
  markingSent?: boolean;
}

function CascadeStep({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-line bg-ink-soft font-mono text-xs text-cloud-dim">
          {index}
        </span>
        <span className="mt-1 w-px flex-1 bg-ink-line" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-cloud-faint">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function DecisionTrace({ pkg, onMarkSent, markingSent }: DecisionTraceProps) {
  const trace = pkg.decisionTrace;
  const rec = pkg.recommendation;

  return (
    <div className="space-y-6">
      {/* Headline decision */}
      <Panel
        title="Recommended next move"
        action={
          <div className="flex items-center gap-2">
            <Pill tone="go">{humanizeAction(trace.chosenAction)}</Pill>
            <span className="font-mono text-sm text-cloud-dim">
              {(rec.confidence * 100).toFixed(0)}% conf
            </span>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud">{(rec.priorityScore * 100).toFixed(0)}</div>
            <div className="text-xs text-cloud-dim">Priority</div>
          </div>
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud">{(rec.urgencyScore * 100).toFixed(0)}</div>
            <div className="text-xs text-cloud-dim">Urgency</div>
          </div>
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud">{(rec.recipientBurden * 100).toFixed(0)}</div>
            <div className="text-xs text-cloud-dim">Recipient burden</div>
          </div>
        </div>

        {pkg.warnings.length ? (
          <div className="mt-3 space-y-1">
            {pkg.warnings.map((w, i) => (
              <p
                key={i}
                className="rounded-md border border-signal-warm/30 bg-signal-warm/10 px-3 py-1.5 text-xs text-signal-warm"
              >
                {w}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* The cascade */}
      <Panel title="Decision trace" subtitle="Conversation → facts → context → routes → decision → draft">
        <div className="pl-0">
          <CascadeStep index={1} label="Conversation">
            <p className="text-sm text-cloud">{trace.inputSummary}</p>
          </CascadeStep>

          <CascadeStep index={2} label="Facts extracted">
            <ul className="space-y-1 text-sm text-cloud">
              {trace.extractedFacts.map((fact, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-signal-calm" aria-hidden>•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </CascadeStep>

          <CascadeStep index={3} label="Public context retrieved">
            {trace.retrievedContext.length ? (
              <ul className="space-y-1 text-sm text-cloud-dim">
                {trace.retrievedContext.map((ctx, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-signal-warm" aria-hidden>•</span>
                    <span>{ctx}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-cloud-faint">
                No public context was available. The decision used the conversation only.
              </p>
            )}
          </CascadeStep>

          <CascadeStep index={4} label="Routes considered">
            <FiveForksView
              routes={trace.routeScores}
              chosenRouteId={trace.chosenRoute.id}
              chosenType={trace.chosenRoute.type}
            />
          </CascadeStep>

          <CascadeStep index={5} label="Decision">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-signal-go/40 bg-signal-go/5 p-3">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-signal-go/80">
                  Why this
                </p>
                <ul className="space-y-1 text-xs text-cloud">
                  {trace.whyThisAction.map((w, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-signal-go" aria-hidden>+</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-ink-line bg-ink-soft/30 p-3">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-cloud-faint">
                  Why not the others
                </p>
                <ul className="space-y-1 text-xs text-cloud-faint">
                  {trace.whyNotOtherActions.map((w, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span aria-hidden>−</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CascadeStep>

          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-signal-go/50 bg-signal-go/10 font-mono text-xs text-signal-go">
                6
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-cloud-faint">Draft</p>
              {pkg.draft ? (
                <DraftPreview draft={pkg.draft} onMarkSent={onMarkSent} marking={markingSent} />
              ) : (
                <p className="text-sm text-cloud-faint">
                  No draft was generated for this action.
                </p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Confidence */}
      <Panel title="Confidence breakdown">
        <ConfidenceBreakdown breakdown={trace.confidenceBreakdown} />
        {trace.safeFactsUsed.length ? (
          <div className="mt-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-cloud-faint">
              Facts safe to use in outreach
            </p>
            <ul className="space-y-1 text-xs text-cloud-dim">
              {trace.safeFactsUsed.map((fact, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-signal-go" aria-hidden>✓</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
