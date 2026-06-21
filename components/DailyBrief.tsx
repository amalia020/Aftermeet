"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarClock, Check, Radio, Search, ShieldAlert, Snowflake, Timer, TrendingDown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { DailyBriefViewModel } from "@/lib/frontend/viewModels";
import type { OutcomeType } from "@/lib/types";

export function DailyBrief({ brief }: { brief: DailyBriefViewModel }) {
  const router = useRouter();
  const [hiddenMoveIds, setHiddenMoveIds] = useState<Set<string>>(new Set());
  const [busyMoveId, setBusyMoveId] = useState<string | null>(null);

  const recordDeferral = async (
    move: DailyBriefViewModel["moves"][number],
    outcomeType: OutcomeType,
    notes: string,
  ) => {
    if (!move.contactId || busyMoveId) return;
    setBusyMoveId(move.id);
    try {
      const response = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: brief.userId,
          contactId: move.contactId,
          recommendationId: move.recommendationId,
          outcomeType,
          notes,
        }),
      });
      if (!response.ok) throw new Error("Unable to record outcome.");
      setHiddenMoveIds((current) => new Set(current).add(move.id));
      router.refresh();
    } finally {
      setBusyMoveId(null);
    }
  };

  return (
    <section className="screen daily-brief">
      <div className="screen-kicker">Today&apos;s relationship brief</div>
      <div className="mission-title-block">
        <h1>{brief.missionTitle}</h1>
        <p>{brief.missionContext}</p>
      </div>

      <div className="brief-hero">
        <div>
          <span className="brief-date">{brief.currentDate}</span>
          <h2>{brief.headline}</h2>
        </div>
        <Link className="capture-fab" href="/capture">
          <Radio size={19} />
          <span>Add a note</span>
        </Link>
      </div>

      <div className="proof-strip">
        {brief.proof.map((item) => (
          <div className="proof-cell" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </div>

      <div className="move-stack">
        {brief.moves.filter((move) => !hiddenMoveIds.has(move.id)).map((move) => {
          const isBusy = busyMoveId === move.id;
          const content = (
            <>
              <Avatar initials={move.initials} tone={move.signal === "network" ? "signal" : "cool"} />
              <div className="move-copy">
                <div className="move-row">
                  <strong>{move.name}</strong>
                  <span className={`pill pill-${move.signal}`}>{move.label}</span>
                </div>
                <p>{move.action}</p>
                <small>{move.reason}</small>
                <div className="move-policy-row">
                  <span>{move.costOfSilence}</span>
                  {move.whatToAvoid[0] ? (
                    <span>
                      <ShieldAlert size={13} />
                      {move.whatToAvoid[0]}
                    </span>
                  ) : null}
                </div>
              </div>
              <ArrowRight className="move-arrow" size={18} />
            </>
          );

          if (move.canDefer && move.contactId) {
            return (
              <article className="move-card move-card-actionable" key={move.id}>
                {content}
                <div className="move-card-actions">
                  {move.href ? (
                    <Link className="secondary-action" href={move.href}>
                      <Search size={16} />
                      Details
                    </Link>
                  ) : null}
                  <button
                    className="secondary-action"
                    disabled={isBusy}
                    onClick={() => recordDeferral(move, "snoozed", "Waited from today's relationship brief.")}
                    type="button"
                  >
                    {isBusy ? <Check size={16} /> : <Timer size={16} />}
                    Wait
                  </button>
                  <button
                    className="secondary-action"
                    disabled={isBusy}
                    onClick={() => recordDeferral(move, "snoozed", "Snoozed from today's relationship brief.")}
                    type="button"
                  >
                    {isBusy ? <Check size={16} /> : <Snowflake size={16} />}
                    Snooze
                  </button>
                </div>
              </article>
            );
          }

          return move.href ? (
            <Link className="move-card" href={move.href} key={move.id}>
              {content}
            </Link>
          ) : (
            <article className="move-card" key={move.id}>
              {content}
            </article>
          );
        })}
      </div>

      {brief.cooling ? (
        <article className="attention-card cooling-card">
          <div className="attention-label">
            <TrendingDown size={18} />
            <span>Cooling relationship</span>
          </div>
          <div className="attention-person">
            <Avatar initials={brief.cooling.initials} tone="warm" />
            <div>
              <h3>{brief.cooling.name}</h3>
              <p>{brief.cooling.reason}</p>
              <small>{brief.cooling.costOfSilence}</small>
            </div>
          </div>
          {brief.cooling.href ? (
            <Link className="ghost-action" href={brief.cooling.href}>
              Re-engage
            </Link>
          ) : (
            <button className="ghost-action">Re-engage</button>
          )}
        </article>
      ) : null}

      <article className="attention-card gap-card">
        <div className="attention-label">
          <CalendarClock size={18} />
          <span>Setup gap</span>
        </div>
        <p>{brief.missionGap}</p>
        <Link className="primary-action" href={brief.activeObjective ? "/capture" : "/objective"}>
          <Search size={17} />
          <span>{brief.activeObjective ? "Add a note" : "Open setup"}</span>
        </Link>
      </article>
    </section>
  );
}
