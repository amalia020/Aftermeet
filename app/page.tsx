"use client";

/**
 * Dashboard (/) — the first screen is the usable app, not a landing page.
 * Shows the active mission, fast entry points, recent activity, and a compact
 * proof strip. Renders from the FrontendMockDataset by default (demo mode);
 * never imports backend intelligence/provider/db modules.
 */

import Link from "next/link";
import { useState } from "react";
import { mockDataset, USE_MOCK } from "@/lib/frontend/mock";
import {
  buildMissionSetupViewModel,
  boardCardsFromDataset,
  tractionFromDataset,
  humanizeGoal,
  humanizeAction,
} from "@/lib/frontend/viewModels";
import { Panel, StatPill, Pill } from "@/components/primitives";
import { MissionSetup } from "@/components/MissionSetup";
import { DemoBadge } from "@/components/AppShell";

const ENTRY_POINTS: { href: string; title: string; body: string; primary?: boolean }[] = [
  {
    href: "/capture",
    title: "Capture a conversation",
    body: "Text, voice, or a card — watch it become a decision in seconds.",
    primary: true,
  },
  { href: "/board", title: "Follow-up board", body: "Move follow-ups from new to booked." },
  { href: "/terminal", title: "Opportunity terminal", body: "Coverage, gaps, and your next cluster." },
  { href: "/traction", title: "Traction", body: "Replies, meetings, and willingness to pay." },
];

export default function DashboardPage() {
  const objective = mockDataset.objective;
  const mission = buildMissionSetupViewModel(objective);
  const traction = tractionFromDataset(mockDataset);
  const board = boardCardsFromDataset(mockDataset);
  const topCard = board[0];
  const [editingMission, setEditingMission] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cloud">Decision terminal</h1>
          <p className="mt-1 text-sm text-cloud-dim">
            Goal-conditioned relationship intelligence for high-density events.
          </p>
        </div>
        {USE_MOCK ? <DemoBadge /> : null}
      </div>

      {/* Active mission */}
      <Panel
        title="Active mission"
        action={
          <button
            type="button"
            onClick={() => setEditingMission((v) => !v)}
            className="rounded-md border border-ink-line px-3 py-1.5 text-xs text-cloud-dim transition hover:text-cloud"
          >
            {editingMission ? "Close" : "Edit mission"}
          </button>
        }
      >
        {editingMission ? (
          <MissionSetup viewModel={mission} onSaved={() => setEditingMission(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span>
              <span className="text-cloud-faint">Role </span>
              <span className="capitalize text-cloud">{objective.role}</span>
            </span>
            <span aria-hidden className="text-cloud-faint">·</span>
            <span>
              <span className="text-cloud-faint">Goal </span>
              <span className="text-cloud">{humanizeGoal(objective.primaryGoal)}</span>
            </span>
            {objective.secondaryGoals.length ? (
              <span className="flex flex-wrap items-center gap-1">
                {objective.secondaryGoals.map((g) => (
                  <Pill key={g}>{humanizeGoal(g)}</Pill>
                ))}
              </span>
            ) : null}
            {objective.eventContext ? (
              <>
                <span aria-hidden className="text-cloud-faint">·</span>
                <span>
                  <span className="text-cloud-faint">Event </span>
                  <span className="text-cloud">{objective.eventContext}</span>
                </span>
              </>
            ) : null}
            <span aria-hidden className="text-cloud-faint">·</span>
            <span>
              <span className="text-cloud-faint">Attention budget </span>
              <span className="font-mono text-cloud">{objective.attentionBudgetToday}</span>
            </span>
          </div>
        )}
      </Panel>

      {/* Entry points */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRY_POINTS.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={[
              "group rounded-xl border p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-calm",
              e.primary
                ? "border-cloud/30 bg-cloud/5 hover:bg-cloud/10"
                : "border-ink-line bg-ink-soft/30 hover:bg-ink-soft/60",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-cloud">{e.title}</p>
            <p className="mt-1 text-xs text-cloud-dim">{e.body}</p>
            <span className="mt-3 inline-block text-xs text-signal-calm group-hover:underline">
              Open →
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Proof strip */}
        <Panel title="Proof so far" subtitle="Outcomes, not vanity counts">
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Replies" value={traction.repliesReceived} />
            <StatPill label="Booked" value={traction.bookedMeetings} />
            <StatPill label="WTP signals" value={traction.wtpSignals} />
            <StatPill label="Paid" value={traction.paidCommits} />
          </div>
          <Link
            href="/traction"
            className="mt-3 inline-block text-xs text-signal-calm hover:underline"
          >
            See full traction →
          </Link>
        </Panel>

        {/* Next move */}
        <Panel title="Your next move" subtitle="The highest-priority follow-up">
          {topCard ? (
            <Link
              href={`/contacts/${encodeURIComponent(topCard.contactId)}`}
              className="block rounded-lg border border-ink-line bg-ink-soft/30 p-4 transition hover:bg-ink-soft/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-cloud">
                  {topCard.contactName ?? "Unnamed contact"}
                  {topCard.company ? (
                    <span className="text-cloud-faint"> · {topCard.company}</span>
                  ) : null}
                </span>
                <Pill tone="go">{humanizeAction(topCard.recommendedAction)}</Pill>
              </div>
              <p className="mt-2 text-xs text-cloud-dim">
                Priority {(topCard.priorityScore * 100).toFixed(0)} · review the decision trace.
              </p>
            </Link>
          ) : (
            <p className="text-sm text-cloud-faint">Capture a conversation to get your first move.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
