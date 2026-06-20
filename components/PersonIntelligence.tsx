"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Edit3,
  Heart,
  MapPin,
  Rocket,
  Send,
  ShieldCheck,
  Snowflake,
  Timer,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { PersonIntelligenceViewModel } from "@/lib/frontend/viewModels";
import type { OutcomeType } from "@/lib/types";

function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function PersonIntelligence({ person }: { person: PersonIntelligenceViewModel }) {
  const router = useRouter();
  const [draft, setDraft] = useState(person.recommendation.draft);
  const [busyOutcome, setBusyOutcome] = useState<OutcomeType | null>(null);
  const [savedOutcome, setSavedOutcome] = useState<OutcomeType | null>(null);

  const recordOutcome = async (outcomeType: OutcomeType) => {
    if (!person.recommendation.contactId) return;
    setBusyOutcome(outcomeType);
    try {
      await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user_demo",
          contactId: person.recommendation.contactId,
          recommendationId: person.recommendation.id,
          outcomeType,
        }),
      });
      setSavedOutcome(outcomeType);
      router.refresh();
    } finally {
      setBusyOutcome(null);
    }
  };

  return (
    <section className="screen person-screen">
      <div className="person-header">
        <Avatar initials={person.contact.initials} tone="signal" size="lg" />
        <div>
          <h1>{person.contact.name}</h1>
          <p>{person.contact.role} at {person.contact.company}</p>
          <span className="location-line">
            <MapPin size={15} />
            {person.contact.location}
          </span>
        </div>
      </div>

      <div className="signal-grid">
        <article>
          <Heart size={20} />
          <span>Warmth</span>
          <strong>{person.warmth}</strong>
        </article>
        <article>
          <Rocket size={20} />
          <span>Mission fit</span>
          <strong>{person.missionFit}</strong>
        </article>
      </div>

      <div className="system-note">
        <span>System note</span>
        <p>{person.systemNote}</p>
      </div>

      <article className="recommendation-panel">
        <div className="section-label">
          <Rocket size={17} />
          <span>Primary recommendation</span>
        </div>
        <h2>{person.recommendation.title}</h2>
        <p>{person.recommendation.reason}</p>
      </article>

      <article className="evidence-panel">
        <div className="section-label">
          <ShieldCheck size={17} />
          <span>Evidence trace</span>
        </div>
        <div className="confidence-grid">
          <div>
            <span>Entity</span>
            <strong>{percent(person.evidence.confidence.entityMatch)}</strong>
          </div>
          <div>
            <span>Sources</span>
            <strong>{percent(person.evidence.confidence.sourceConfidence)}</strong>
          </div>
          <div>
            <span>Facts</span>
            <strong>{percent(person.evidence.confidence.factConfidence)}</strong>
          </div>
          <div>
            <span>Final</span>
            <strong>{percent(person.evidence.confidence.finalConfidence)}</strong>
          </div>
        </div>
        {person.evidence.facts.length ? (
          <ul className="evidence-list">
            {person.evidence.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : (
          <p className="evidence-empty">No safe evidence facts have been persisted yet.</p>
        )}
      </article>

      <article className="avoid-panel">
        <XCircle size={19} />
        <div>
          <strong>What to avoid</strong>
          <p>{person.recommendation.avoid}</p>
        </div>
      </article>

      <div className="draft-panel">
        <div className="draft-title">
          <span>Proposed message</span>
          <button type="button">
            <Edit3 size={15} />
            Edit
          </button>
        </div>
        <textarea
          aria-label="Proposed follow-up message"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
      </div>

      <div className="manual-actions">
        <button
          className="primary-action"
          disabled={busyOutcome !== null}
          onClick={() => recordOutcome("sent")}
        >
          {savedOutcome === "sent" ? <Check size={17} /> : <Send size={17} />}
          {savedOutcome === "sent" ? "Marked sent" : "Send manually"}
        </button>
        <button
          className="secondary-action"
          disabled={busyOutcome !== null}
          onClick={() => recordOutcome("snoozed")}
        >
          <Timer size={17} />
          Wait
        </button>
        <button
          className="secondary-action"
          disabled={busyOutcome !== null}
          onClick={() => recordOutcome("snoozed")}
        >
          <Snowflake size={17} />
          Snooze
        </button>
      </div>
    </section>
  );
}
