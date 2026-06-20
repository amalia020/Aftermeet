import Link from "next/link";
import { ArrowRight, CalendarClock, Radio, Search, TrendingDown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { DailyBriefViewModel } from "@/lib/frontend/mockData";

export function DailyBrief({ brief }: { brief: DailyBriefViewModel }) {
  return (
    <section className="screen daily-brief">
      <div className="screen-kicker">Today&apos;s relationship brief</div>
      <div className="mission-title-block">
        <h1>{brief.activeObjective.companyName ? "Recruit Core Talent" : "Active Mission"}</h1>
        <p>Active mission context</p>
      </div>

      <div className="brief-hero">
        <div>
          <span className="brief-date">Saturday, June 20</span>
          <h2>{brief.headline}</h2>
        </div>
        <Link className="capture-fab" href="/capture">
          <Radio size={19} />
          <span>Capture signal</span>
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
        {brief.moves.map((move) => {
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
              </div>
              <ArrowRight className="move-arrow" size={18} />
            </>
          );

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
          </div>
        </div>
        <button className="ghost-action">Re-engage</button>
      </article>

      <article className="attention-card gap-card">
        <div className="attention-label">
          <CalendarClock size={18} />
          <span>Mission gap</span>
        </div>
        <p>{brief.missionGap}</p>
        <Link className="primary-action" href="/terminal">
          <Search size={17} />
          <span>Open radar</span>
        </Link>
      </article>
    </section>
  );
}
