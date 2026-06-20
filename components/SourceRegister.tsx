"use client";

/**
 * SourceRegister (Part 4) — provenance for every fact. Shows where each piece of
 * context came from (conversation, Cala, web), with confidence and a link when
 * available. If context was unavailable, that is shown plainly — never invented.
 */

import type { EvidenceBundle, SourceRecord } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = {
  conversation: "Conversation",
  cala: "Cala (verified)",
  web: "Public web",
  business_card: "Business card",
  manual: "Manual",
};

const PROVIDER_TONE: Record<string, string> = {
  conversation: "text-signal-calm",
  cala: "text-signal-go",
  web: "text-signal-warm",
  business_card: "text-cloud-dim",
  manual: "text-cloud-dim",
};

export interface SourceRegisterProps {
  sources: SourceRecord[];
  enrichment?: EvidenceBundle["enrichment"];
}

export function SourceRegister({ sources, enrichment }: SourceRegisterProps) {
  if (!sources.length) {
    return (
      <p className="text-sm text-cloud-faint">
        No public context was available for this contact. Only the conversation itself was
        used — no facts were invented.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {enrichment && enrichment.status !== "available" ? (
        <p className="rounded-md border border-ink-line bg-ink-soft/40 px-3 py-2 text-xs text-cloud-dim">
          Enrichment status: <span className="text-cloud">{enrichment.status.replaceAll("_", " ")}</span>
          {enrichment.warnings.length ? ` — ${enrichment.warnings[0]}` : ""}
        </p>
      ) : null}

      <ul className="divide-y divide-ink-line/60 overflow-hidden rounded-lg border border-ink-line">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center justify-between gap-3 bg-ink-soft/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${PROVIDER_TONE[source.provider] ?? "text-cloud-dim"}`}
                >
                  {PROVIDER_LABEL[source.provider] ?? source.provider}
                </span>
                <span className="truncate text-sm text-cloud">
                  {source.sourceName ?? source.sourceType.replaceAll("_", " ")}
                </span>
              </div>
              {source.sourceUrl ? (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-xs text-signal-calm hover:underline"
                >
                  {source.sourceUrl}
                </a>
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-xs text-cloud-dim">
              {(source.sourceConfidence * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
