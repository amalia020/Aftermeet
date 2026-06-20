"use client";

/**
 * TractionView (Part 4) — leads with PROOF metrics (replies, booked, WTP, paid),
 * not vanity counts (captures, signups). Reply rate is broken down by opportunity
 * type so the user sees which kind of conversation actually converts.
 */

import type { TractionViewModel } from "@/lib/types";
import { humanizeRouteType } from "@/lib/frontend/viewModels";
import { Panel, ScoreBar, StatPill, EmptyState } from "./primitives";

export interface TractionViewProps {
  viewModel: TractionViewModel;
}

export function TractionView({ viewModel }: TractionViewProps) {
  const t = viewModel.summary;

  if (viewModel.state === "empty") {
    return (
      <EmptyState
        title="No outcomes yet"
        body="Mark follow-ups as sent, replied, or booked and your proof metrics will build here."
      />
    );
  }

  const replyRows = Object.entries(t.replyRateByOpportunityType);

  return (
    <div className="space-y-6">
      {/* Proof metrics first */}
      <Panel
        title="Proof"
        subtitle="Outcomes that show the relationship work is paying off"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Replies received" value={t.repliesReceived} />
          <StatPill label="Meetings booked" value={t.bookedMeetings} />
          <StatPill label="WTP signals" value={t.wtpSignals} />
          <StatPill label="Paid commitments" value={t.paidCommits} />
        </div>
      </Panel>

      {/* Reply rate by opportunity type */}
      <Panel title="Reply rate by opportunity type">
        {replyRows.length ? (
          <div className="space-y-3">
            {replyRows.map(([type, rate]) => (
              <div key={type}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-cloud">{humanizeRouteType(type)}</span>
                  <span className="font-mono text-cloud-dim">
                    {((rate ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <ScoreBar value={rate ?? 0} tone="go" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cloud-faint">
            No replies recorded yet — reply rates appear here once follow-ups get responses.
          </p>
        )}
      </Panel>

      {/* Supporting (non-vanity) context, kept secondary and muted */}
      <Panel title="Activity" subtitle="Context for the proof above — not the headline">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud-dim">{t.followUpsSent}</div>
            <div className="text-xs text-cloud-faint">Follow-ups sent</div>
          </div>
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud-dim">{t.actionsCompleted}</div>
            <div className="text-xs text-cloud-faint">Actions completed</div>
          </div>
          <div className="rounded-lg border border-ink-line bg-ink-soft/30 px-3 py-2">
            <div className="font-mono text-lg text-cloud-dim">
              {t.contactsArchivedOrIgnored}
            </div>
            <div className="text-xs text-cloud-faint">Set aside / ignored</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
