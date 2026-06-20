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
import type { OutcomeCreateResponse, TractionSummary } from "@/lib/types";

const optionIcons = [CheckCircle2, CalendarCheck, Handshake, Briefcase, Ban, Ban];

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

  return (
    <section className="screen loop-screen">
      <div className="loop-hero">
        <Avatar initials={loop.contact.initials} tone="signal" size="lg" />
        <h1>{loop.prompt}</h1>
        <p>Feedback keeps the daily brief tuned to your real mission fit.</p>
      </div>

      <div className="outcome-options">
        {loop.options.map((option, index) => {
          const Icon = optionIcons[index] ?? CheckCircle2;
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
