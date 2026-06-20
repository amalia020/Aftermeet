"use client";

/**
 * ActionQueue (Part 4) — the prioritized list of next manual moves, bounded by
 * the attention budget. It never auto-acts: each row links to the person so the
 * user decides. Rows beyond the budget are dimmed as "beyond today's budget".
 */

import Link from "next/link";
import type { FollowUpBoardCard } from "@/lib/types";
import { humanizeAction } from "@/lib/frontend/viewModels";
import { warmthLabel } from "@/lib/frontend/formatting";
import { EmptyState, Pill } from "./primitives";

export interface ActionQueueProps {
  cards: FollowUpBoardCard[];
  attentionBudgetRemaining: number;
}

export function ActionQueue({ cards, attentionBudgetRemaining }: ActionQueueProps) {
  if (!cards.length) {
    return (
      <EmptyState
        title="Nothing in the queue"
        body="When a conversation needs a next move, it shows up here — ordered by priority, capped by your attention budget."
      />
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-cloud-dim">
        <span className="font-mono text-cloud">{attentionBudgetRemaining}</span> of today's
        attention budget remaining.
      </p>
      <ul className="divide-y divide-ink-line/60 overflow-hidden rounded-xl border border-ink-line">
        {cards.map((card, i) => {
          const beyondBudget = i >= attentionBudgetRemaining && attentionBudgetRemaining > 0;
          return (
            <li
              key={card.contactId}
              className={[
                "bg-ink-soft/30 transition hover:bg-ink-soft/60",
                beyondBudget ? "opacity-50" : "",
              ].join(" ")}
            >
              <Link
                href={`/contacts/${encodeURIComponent(card.contactId)}`}
                className="flex items-center gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-calm"
              >
                <span className="font-mono text-xs text-cloud-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-cloud">
                      {card.contactName ?? "Unnamed contact"}
                    </span>
                    {card.company ? (
                      <span className="truncate text-xs text-cloud-faint">· {card.company}</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-cloud-dim">{warmthLabel(card.warmthScore)}</p>
                </div>
                <Pill tone="calm">{humanizeAction(card.recommendedAction)}</Pill>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
