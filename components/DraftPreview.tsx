"use client";

/**
 * DraftPreview (Part 4) — editable draft with explicit manual-send controls only.
 * Shows which facts were used and any risk note. AfterMeet never sends anything
 * automatically; the user copies / marks-as-sent themselves.
 */

import { useState } from "react";
import type { Draft } from "@/lib/types";
import { Pill } from "./primitives";

export interface DraftPreviewProps {
  draft: Draft;
  onMarkSent?: () => void;
  marking?: boolean;
}

export function DraftPreview({ draft, onMarkSent, marking }: DraftPreviewProps) {
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="calm">{draft.channel}</Pill>
        {draft.tone ? <Pill>{draft.tone}</Pill> : null}
        <span className="ml-auto text-[11px] text-cloud-faint">
          Review and send manually — nothing is sent automatically.
        </span>
      </div>

      {draft.channel === "email" ? (
        <div>
          <label htmlFor="draft-subject" className="mb-1 block text-xs text-cloud-dim">
            Subject
          </label>
          <input
            id="draft-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-ink-line bg-ink px-3 py-2 text-sm text-cloud focus:border-signal-calm focus:outline-none"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="draft-body" className="mb-1 block text-xs text-cloud-dim">
          Message
        </label>
        <textarea
          id="draft-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          className="w-full resize-y rounded-md border border-ink-line bg-ink px-3 py-2.5 text-sm leading-relaxed text-cloud focus:border-signal-calm focus:outline-none"
        />
      </div>

      {draft.riskNote ? (
        <p className="rounded-md border border-signal-warm/30 bg-signal-warm/10 px-3 py-2 text-xs text-signal-warm">
          Risk note: {draft.riskNote}
        </p>
      ) : null}

      {draft.factsUsed.length ? (
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-cloud-faint">Facts used</p>
          <ul className="space-y-1 text-xs text-cloud-dim">
            {draft.factsUsed.map((fact, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-signal-go" aria-hidden>✓</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-cloud px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cloud"
        >
          {copied ? "Copied" : "Copy draft"}
        </button>
        {onMarkSent ? (
          <button
            type="button"
            onClick={onMarkSent}
            disabled={marking}
            className="rounded-md border border-ink-line px-3 py-1.5 text-sm text-cloud-dim transition hover:text-cloud disabled:opacity-50"
          >
            {marking ? "Saving…" : "I sent this"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
