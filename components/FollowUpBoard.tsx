"use client";

/**
 * FollowUpBoard (Part 4) — status columns New / Drafted / Sent / Reply / Booked.
 * Calm by default: each card shows a WarmthDecayBar and the recommended next
 * move, with a rare warning flag only when the card itself is flagged. Manual
 * outcome actions advance a card; nothing is ever sent automatically.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  FollowUpBoardCard,
  FollowUpBoardViewModel,
  OutcomeType,
} from "@/lib/types";
import { humanizeAction } from "@/lib/frontend/viewModels";
import { recordOutcome } from "@/lib/frontend/apiClient";
import { EmptyState, Pill } from "./primitives";
import { WarmthDecayBar } from "./WarmthDecayBar";

const COLUMN_META: Record<
  FollowUpBoardCard["status"],
  { label: string; hint: string }
> = {
  new: { label: "New", hint: "Captured, not yet drafted" },
  drafted: { label: "Drafted", hint: "Draft ready to review" },
  sent: { label: "Sent", hint: "You sent a follow-up" },
  reply: { label: "Reply", hint: "They replied" },
  booked: { label: "Booked", hint: "Meeting on the calendar" },
  archived: { label: "Archived", hint: "Set aside" },
};

/** The manual outcome a card can advance to from each status. */
const NEXT_OUTCOME: Partial<Record<FollowUpBoardCard["status"], { type: OutcomeType; label: string }>> = {
  new: { type: "sent", label: "Mark sent" },
  drafted: { type: "sent", label: "Mark sent" },
  sent: { type: "reply", label: "Got a reply" },
  reply: { type: "booked", label: "Booked a meeting" },
};

export interface FollowUpBoardProps {
  viewModel: FollowUpBoardViewModel;
  /** Live mode passes false so outcome actions hit the API; demo keeps it true. */
  demoMode?: boolean;
}

export function FollowUpBoard({ viewModel, demoMode = true }: FollowUpBoardProps) {
  const [overrides, setOverrides] = useState<Record<string, FollowUpBoardCard["status"]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const columns = useMemo(() => viewModel.columns, [viewModel.columns]);

  if (viewModel.state === "empty" || !columns.some((c) => c.cards.length)) {
    return (
      <EmptyState
        title="Your board is clear"
        body="As you capture conversations, follow-ups land here and move through New → Drafted → Sent → Reply → Booked."
        action={
          <Link
            href="/capture"
            className="rounded-md bg-cloud px-3 py-1.5 text-sm font-medium text-ink hover:bg-white"
          >
            Capture a conversation
          </Link>
        }
      />
    );
  }

  const advance = async (card: FollowUpBoardCard) => {
    const next = NEXT_OUTCOME[card.status];
    if (!next) return;
    const key = card.recommendationId ?? card.contactId;
    setBusy(key);
    // Optimistically move the card; in live mode also record the outcome.
    const nextStatus = (next.type === "sent"
      ? "sent"
      : next.type === "reply"
        ? "reply"
        : "booked") as FollowUpBoardCard["status"];
    setOverrides((prev) => ({ ...prev, [card.contactId]: nextStatus }));
    if (!demoMode) {
      await recordOutcome({
        contactId: card.contactId,
        recommendationId: card.recommendationId,
        outcomeType: next.type,
      });
    }
    setBusy(null);
  };

  // Apply optimistic overrides into the column layout.
  const allCards = columns.flatMap((c) => c.cards);
  const statusOrder = columns.map((c) => c.status);
  const grouped = statusOrder.map((status) => ({
    status,
    cards: allCards.filter(
      (card) => (overrides[card.contactId] ?? card.status) === status,
    ),
  }));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {grouped.map((column) => {
        const meta = COLUMN_META[column.status];
        return (
          <div
            key={column.status}
            className="flex min-h-[8rem] flex-col rounded-xl border border-ink-line bg-ink-soft/30"
          >
            <div className="border-b border-ink-line/60 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-cloud-dim">
                  {meta.label}
                </span>
                <span className="font-mono text-xs text-cloud-faint">
                  {column.cards.length}
                </span>
              </div>
              <p className="text-[10px] text-cloud-faint">{meta.hint}</p>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {column.cards.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11px] text-cloud-faint">
                  Nothing here
                </p>
              ) : (
                column.cards.map((card) => {
                  const next = NEXT_OUTCOME[column.status];
                  const key = card.recommendationId ?? card.contactId;
                  // Booked cards must never flag as cold.
                  const showWarning = card.warning && column.status !== "booked";
                  return (
                    <div
                      key={card.contactId}
                      className="rounded-lg border border-ink-line bg-ink p-3"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <Link
                          href={`/contacts/${encodeURIComponent(card.contactId)}`}
                          className="truncate text-sm font-medium text-cloud hover:text-white"
                        >
                          {card.contactName ?? "Unnamed contact"}
                        </Link>
                      </div>
                      {card.company ? (
                        <p className="mb-2 truncate text-[11px] text-cloud-dim">{card.company}</p>
                      ) : null}

                      <div className="mb-2">
                        <Pill tone="calm">{humanizeAction(card.recommendedAction)}</Pill>
                      </div>

                      <WarmthDecayBar
                        warmth={card.warmthScore}
                        warning={showWarning}
                        warningReason={card.warningReason}
                        compact
                      />

                      {next ? (
                        <button
                          type="button"
                          onClick={() => advance(card)}
                          disabled={busy === key}
                          className="mt-2 w-full rounded-md border border-ink-line px-2 py-1 text-[11px] text-cloud-dim transition hover:text-cloud disabled:opacity-50"
                        >
                          {busy === key ? "Saving…" : next.label}
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
