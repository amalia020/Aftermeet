"use client";

/**
 * ContactList (Part 4) — calm by default. Lists contacts with a freshness dot and
 * status; a "follow up now" flag is rare and only shown when the caller marks it.
 * No leaderboard / grading language.
 */

import Link from "next/link";
import type { ContactListViewModel } from "@/lib/types";
import { EmptyState, Pill } from "./primitives";

export interface ContactListProps {
  viewModel: ContactListViewModel;
  /** Optional set of contact ids that warrant a rare follow-up-now flag. */
  followUpNowIds?: Set<string>;
}

function freshnessFromTimestamp(ts?: string | null): { tone: string; label: string } {
  if (!ts) return { tone: "bg-cloud-faint", label: "No recent activity" };
  const ageDays = (Date.now() - new Date(ts).getTime()) / 86_400_000;
  if (ageDays <= 2) return { tone: "bg-signal-go", label: "Fresh" };
  if (ageDays <= 7) return { tone: "bg-signal-warm", label: "Cooling" };
  return { tone: "bg-cloud-faint", label: "Older" };
}

export function ContactList({ viewModel, followUpNowIds }: ContactListProps) {
  if (viewModel.state === "empty" || !viewModel.contacts.length) {
    return (
      <EmptyState
        title="No contacts yet"
        body="Capture a conversation and the people you meet will appear here, calm and organized."
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

  return (
    <ul className="divide-y divide-ink-line/60 overflow-hidden rounded-xl border border-ink-line">
      {viewModel.contacts.map((contact) => {
        const fresh = freshnessFromTimestamp(contact.lastRelevantActionAt);
        const flagNow = followUpNowIds?.has(contact.id);
        return (
          <li key={contact.id} className="bg-ink-soft/30 transition hover:bg-ink-soft/60">
            <Link
              href={`/contacts/${encodeURIComponent(contact.id)}`}
              className="flex items-center gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-calm"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${fresh.tone}`} aria-hidden />
              <span className="sr-only">{fresh.label}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-cloud">
                    {contact.name ?? "Unnamed contact"}
                  </span>
                  {flagNow ? <Pill tone="warm">Follow up now</Pill> : null}
                </div>
                <p className="truncate text-xs text-cloud-dim">
                  {[contact.role, contact.company].filter(Boolean).join(" · ") || "No details"}
                </p>
              </div>
              <Pill>{contact.status}</Pill>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
