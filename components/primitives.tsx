/**
 * Small shared visual primitives for Part 4 (Tailwind only, no external libs).
 * Stable dimensions to avoid layout shift; accessible by default.
 */

import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-ink-line bg-ink-soft/40 p-5 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cloud-dim">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs text-cloud-faint">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function ScoreBar({
  value,
  tone = "calm",
  label,
}: {
  value: number;
  tone?: "calm" | "go" | "warm" | "stop" | "neutral";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const colors: Record<string, string> = {
    calm: "bg-signal-calm",
    go: "bg-signal-go",
    warm: "bg-signal-warm",
    stop: "bg-signal-stop",
    neutral: "bg-cloud-faint",
  };
  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-cloud-dim">
          <span>{label}</span>
          <span className="font-mono text-cloud">{pct.toFixed(0)}%</span>
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all ${colors[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "calm" | "go" | "warm" | "stop";
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-line bg-ink-soft text-cloud-dim",
    calm: "border-signal-calm/40 bg-signal-calm/10 text-signal-calm",
    go: "border-signal-go/40 bg-signal-go/10 text-signal-go",
    warm: "border-signal-warm/40 bg-signal-warm/10 text-signal-warm",
    stop: "border-signal-stop/40 bg-signal-stop/10 text-signal-stop",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function FreshnessDot({ warmth }: { warmth: number }) {
  const tone =
    warmth >= 0.6 ? "bg-signal-go" : warmth >= 0.35 ? "bg-signal-warm" : "bg-cloud-faint";
  const label =
    warmth >= 0.6 ? "Fresh" : warmth >= 0.35 ? "Cooling" : "Cold";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-cloud-dim">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden />
      <span className="sr-only">Warmth: </span>
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-line bg-ink-soft/20 px-6 py-12 text-center">
      <p className="text-sm font-medium text-cloud">{title}</p>
      {body ? <p className="mt-2 max-w-sm text-sm text-cloud-dim">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft/40 px-4 py-3">
      <div className="font-mono text-2xl text-cloud">{value}</div>
      <div className="mt-1 text-xs text-cloud-dim">{label}</div>
    </div>
  );
}
