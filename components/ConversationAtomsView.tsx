"use client";

/**
 * ConversationAtomsView (Part 4) — renders the structured atoms extracted from a
 * conversation: facts, asks, offers, commitments, uncertainties, and sentiment.
 * Sensitive atoms are flagged so the user knows what will not be used in drafts.
 */

import type { ConversationAtoms } from "@/lib/types";
import { Pill } from "./primitives";

export interface ConversationAtomsViewProps {
  atoms: ConversationAtoms;
}

function Group({
  title,
  items,
  tone = "neutral",
}: {
  title: string;
  items: { text: string; note?: string; sensitive?: boolean }[];
  tone?: "neutral" | "calm" | "go" | "warm";
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-cloud-faint">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-2 rounded-md border border-ink-line bg-ink-soft/30 px-3 py-2 text-sm text-cloud"
          >
            <span>{item.text}</span>
            <span className="flex shrink-0 items-center gap-1">
              {item.sensitive ? <Pill tone="stop">Sensitive</Pill> : null}
              {item.note ? <Pill tone={tone}>{item.note}</Pill> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConversationAtomsView({ atoms }: ConversationAtomsViewProps) {
  return (
    <div className="space-y-4">
      {atoms.sentiment ? (
        <div className="flex items-center gap-2 text-xs text-cloud-dim">
          <span>Sentiment</span>
          <Pill tone="calm">{atoms.sentiment}</Pill>
          <span className="ml-auto font-mono text-cloud-faint">
            extraction {(atoms.extractionConfidence * 100).toFixed(0)}%
          </span>
        </div>
      ) : null}

      <Group
        title="Facts"
        items={atoms.facts.map((f) => ({
          text: f.text,
          note: f.type ?? undefined,
          sensitive: f.isSensitive,
        }))}
      />
      <Group
        title="Asks"
        items={atoms.asks.map((a) => ({ text: a.text }))}
        tone="warm"
      />
      <Group
        title="Offers"
        items={atoms.offers.map((o) => ({ text: o.text }))}
        tone="go"
      />
      <Group
        title="Commitments"
        items={atoms.commitments.map((c) => ({
          text: c.text,
          note: c.owner ?? undefined,
        }))}
        tone="calm"
      />

      {atoms.uncertainties.length ? (
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-cloud-faint">
            Uncertainties
          </p>
          <ul className="space-y-1 text-xs text-cloud-dim">
            {atoms.uncertainties.map((u, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden>?</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
