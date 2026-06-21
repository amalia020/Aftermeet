"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Ban,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Handshake,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { OutcomeLoopViewModel } from "@/lib/frontend/viewModels";
import type { OutcomeCreateResponse, OutcomeType, TractionSummary } from "@/lib/types";

const optionIcons: Partial<Record<OutcomeType, typeof CheckCircle2>> = {
  reply: CheckCircle2,
  booked: CalendarCheck,
  wtp: Handshake,
  paid: Briefcase,
  marked_not_relevant: Ban,
  ignored: Ban,
};

export function OutcomeLoop({ loop }: { loop: OutcomeLoopViewModel }) {
  const router = useRouter();
  const [summary, setSummary] = useState<TractionSummary>(loop.summary);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const recordOutcome = async (option: OutcomeLoopViewModel["options"][number]) => {
    if (!loop.target) return;
    setBusyId(option.id);
    try {
      const response = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: loop.target.userId,
          contactId: loop.target.contactId,
          recommendationId: loop.target.recommendationId,
          outcomeType: option.outcomeType,
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as OutcomeCreateResponse;
        setSummary(payload.updatedTraction);
        setSelectedId(option.id);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loop.state === "empty" || !loop.target) {
    return (
      <section className="screen loop-screen">
        <div className="loop-hero">
          <Avatar initials={loop.contact.initials} tone="muted" size="lg" />
          <h1>No moves to log yet</h1>
          <p>{loop.contact.location}</p>
        </div>
        <div className="traction-strip">
          <div>
            <strong>{summary.repliesReceived}</strong>
            <span>Replies</span>
          </div>
          <div>
            <strong>{summary.bookedMeetings}</strong>
            <span>Booked</span>
          </div>
          <div>
            <strong>{summary.actionsCompleted}</strong>
            <span>Moves logged</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen loop-screen">
      <div className="loop-hero">
        <Avatar initials={loop.contact.initials} tone="signal" size="lg" />
        <h1>{loop.prompt}</h1>
        <p>Feedback keeps the daily brief tuned to your real mission fit.</p>
      </div>

      <div className="outcome-options">
        {loop.options.map((option) => {
          const Icon = optionIcons[option.outcomeType] ?? CheckCircle2;
          const selected = selectedId === option.id;
          return (
            <button
              className={`outcome-option outcome-${option.kind}`}
              disabled={!loop.target || busyId !== null}
              key={option.id}
              onClick={() => recordOutcome(option)}
            >
              {selected ? <CheckCircle2 size={30} /> : <Icon size={30} />}
              <span>{selected ? "Logged" : option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="traction-strip">
        <div>
          <strong>{summary.repliesReceived}</strong>
          <span>Replies</span>
        </div>
        <div>
          <strong>{summary.bookedMeetings}</strong>
          <span>Booked</span>
        </div>
        <div>
          <strong>{summary.actionsCompleted}</strong>
          <span>Moves logged</span>
        </div>
      </div>
      <button
        className="skip-button"
        disabled={!loop.target || busyId !== null}
        onClick={() =>
          recordOutcome({
            id: "skip",
            label: "Skip",
            kind: "neutral",
            outcomeType: "snoozed",
          })
        }
      >
        Skip for now
      </button>
    </section>
  );
}
