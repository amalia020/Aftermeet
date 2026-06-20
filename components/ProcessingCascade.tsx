"use client";

/**
 * ProcessingCascade (Part 4) — animates the pipeline stages from capture through
 * draft generation. Renders from PipelineStageView[] so it works identically from
 * a live SSE stream or a fixture replay. Stable row dimensions avoid layout
 * shift as statuses change.
 */

import type { PipelineStageView } from "@/lib/types";

const STATUS_META: Record<
  PipelineStageView["status"],
  { dot: string; ring: string; label: string; text: string }
> = {
  idle: { dot: "bg-ink-line", ring: "border-ink-line", label: "Waiting", text: "text-cloud-faint" },
  active: {
    dot: "bg-signal-calm animate-pulse",
    ring: "border-signal-calm",
    label: "Working",
    text: "text-cloud",
  },
  complete: { dot: "bg-signal-go", ring: "border-signal-go", label: "Done", text: "text-cloud" },
  fallback: {
    dot: "bg-signal-warm",
    ring: "border-signal-warm",
    label: "Demo fallback",
    text: "text-cloud",
  },
  blocked: { dot: "bg-cloud-faint", ring: "border-ink-line", label: "Skipped", text: "text-cloud-faint" },
  error: { dot: "bg-signal-stop", ring: "border-signal-stop", label: "Error", text: "text-cloud" },
};

export interface ProcessingCascadeProps {
  stages: PipelineStageView[];
  title?: string;
}

export function ProcessingCascade({ stages, title = "Processing" }: ProcessingCascadeProps) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-cloud-dim">
        {title}
      </h2>
      <ol className="space-y-0">
        {stages.map((stage, i) => {
          const meta = STATUS_META[stage.status];
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  className="absolute left-[7px] top-5 h-full w-px bg-ink-line"
                  aria-hidden
                />
              ) : null}
              <span
                className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${meta.ring} ${meta.dot}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${meta.text}`}>{stage.label}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                      stage.status === "complete"
                        ? "bg-signal-go/10 text-signal-go"
                        : stage.status === "active"
                          ? "bg-signal-calm/10 text-signal-calm"
                          : stage.status === "fallback"
                            ? "bg-signal-warm/10 text-signal-warm"
                            : stage.status === "error"
                              ? "bg-signal-stop/10 text-signal-stop"
                              : "bg-ink-line/60 text-cloud-faint",
                    ].join(" ")}
                  >
                    {meta.label}
                  </span>
                </div>
                {stage.description ? (
                  <p className="text-xs text-cloud-faint">{stage.description}</p>
                ) : null}
                {stage.warning ? (
                  <p className="mt-1 text-xs text-signal-warm">{stage.warning}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
