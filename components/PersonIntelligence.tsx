"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Heart,
  ListChecks,
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

function listItemKey(value: string, index: number): string {
  return `${index}-${value}`;
}

export function PersonIntelligence({ person }: { person: PersonIntelligenceViewModel }) {
  const router = useRouter();
  const [draft, setDraft] = useState(person.recommendation.draft);
  const [busyOutcome, setBusyOutcome] = useState<OutcomeType | null>(null);
  const [savedOutcome, setSavedOutcome] = useState<OutcomeType | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);
  const [details, setDetails] = useState({
    name: person.contact.name,
    role: person.contact.role,
    company: person.contact.company,
    email: person.contact.email ?? "",
    phone: person.contact.phone ?? "",
    website: person.contact.website ?? "",
    linkedinUrl: person.contact.linkedinUrl ?? "",
  });
  const needsDetailsConfirmation = person.recommendation.actionKey === "confirm_details";

  if (person.state === "empty") {
    return (
      <section className="screen person-screen">
        <div className="person-header">
          <Avatar initials={person.contact.initials} tone="muted" size="lg" />
          <div>
            <h1>{person.contact.name}</h1>
            <span className="location-line">
              <MapPin size={15} />
              {person.contact.location}
            </span>
          </div>
        </div>
        <div className="system-note">
          <span>System note</span>
          <p>{person.systemNote}</p>
        </div>
        <Link className="primary-action" href="/capture">
          <Send size={17} />
          <span>Capture a signal</span>
        </Link>
      </section>
    );
  }

  const recordOutcome = async (outcomeType: OutcomeType) => {
    if (!person.recommendation.contactId) return;
    setBusyOutcome(outcomeType);
    try {
      const response = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user_demo",
          contactId: person.recommendation.contactId,
          recommendationId: person.recommendation.id,
          outcomeType,
        }),
      });
      if (!response.ok) throw new Error("Unable to record outcome.");
      setSavedOutcome(outcomeType);
      router.refresh();
      if (outcomeType === "marked_not_relevant") router.push("/");
    } finally {
      setBusyOutcome(null);
    }
  };

  const saveConfirmedDetails = async () => {
    if (!person.recommendation.contactId) return;
    setSavingDetails(true);
    try {
      const response = await fetch(`/api/contacts/${person.recommendation.contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_demo", ...details }),
      });
      if (!response.ok) throw new Error("Unable to confirm contact details.");
      setSavedOutcome("details_confirmed");
      setConfirmationOpen(false);
      router.refresh();
    } finally {
      setSavingDetails(false);
    }
  };

  const removeContact = async () => {
    if (!person.recommendation.contactId || !window.confirm("Delete this contact and all related evidence?")) return;
    setDeletingContact(true);
    try {
      const response = await fetch(
        `/api/contacts/${person.recommendation.contactId}?userId=user_demo`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Unable to delete contact.");
      router.push("/capture");
      router.refresh();
    } finally {
      setDeletingContact(false);
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
        {person.recommendation.whyNow.length ? (
          <ul className="policy-list">
            {person.recommendation.whyNow.map((reason, index) => (
              <li key={listItemKey(reason, index)}>{reason}</li>
            ))}
          </ul>
        ) : null}
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
        <EvidenceProfileCard
          profile={person.evidence.profile}
          sources={person.evidence.sources}
        />
        {person.evidence.warnings.map((warning, index) => (
          <div className="analysis-alert" key={listItemKey(warning, index)} role="status">
            <AlertTriangle size={18} />
            <span>{warning}</span>
          </div>
        ))}
      </article>

      {confirmationOpen ? (
        <section className="confirmation-panel" aria-label="Confirm contact details">
          <div className="section-label">
            <Check size={17} />
            <span>Confirm identity</span>
          </div>
          <div className="confirmation-grid">
            {Object.entries(details).map(([field, value]) => (
              <label key={field}>
                <span>{field === "linkedinUrl" ? "LinkedIn URL" : field}</span>
                <input
                  onChange={(event) =>
                    setDetails((current) => ({ ...current, [field]: event.target.value }))
                  }
                  value={value}
                />
              </label>
            ))}
          </div>
          <div className="confirmation-actions">
            <button className="primary-action" disabled={savingDetails} onClick={saveConfirmedDetails} type="button">
              <Check size={17} />
              {savingDetails ? "Saving" : "Save confirmed details"}
            </button>
            <button className="secondary-action" onClick={() => setConfirmationOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <article className="evidence-panel">
        <div className="section-label">
          <ListChecks size={17} />
          <span>Draft policy</span>
        </div>
        <div className="policy-columns">
          <div>
            <strong>Safe facts</strong>
            {person.recommendation.safeFacts.length ? (
              <ul className="evidence-list">
                {person.recommendation.safeFacts.map((fact, index) => (
                  <li key={listItemKey(fact, index)}>{fact}</li>
                ))}
              </ul>
            ) : (
              <p className="evidence-empty">No safe facts selected for draft use.</p>
            )}
          </div>
          <div>
            <strong>Blocked facts</strong>
            {person.recommendation.blockedFacts.length ? (
              <ul className="evidence-list">
                {person.recommendation.blockedFacts.map((fact, index) => (
                  <li key={listItemKey(fact, index)}>{fact}</li>
                ))}
              </ul>
            ) : (
              <p className="evidence-empty">No facts blocked by the daily policy.</p>
            )}
          </div>
        </div>
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
        {needsDetailsConfirmation ? (
          <button
            className="primary-action"
            disabled={busyOutcome !== null}
            onClick={() => setConfirmationOpen(true)}
          >
            <Check size={17} />
            {savedOutcome === "details_confirmed" ? "Details confirmed" : "Review details"}
          </button>
        ) : (
          <button
            className="primary-action"
            disabled={busyOutcome !== null}
            onClick={() => recordOutcome("sent")}
          >
            {savedOutcome === "sent" ? <Check size={17} /> : <Send size={17} />}
            {savedOutcome === "sent" ? "Marked sent" : "Send manually"}
          </button>
        )}
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
        <button
          className="secondary-action danger-action"
          disabled={busyOutcome !== null || deletingContact}
          onClick={removeContact}
        >
          <Trash2 size={17} />
          {deletingContact ? "Deleting" : "Delete"}
        </button>
      </div>
    </section>
  );
}

function EvidenceProfileCard({
  profile,
  sources,
}: {
  profile: PersonIntelligenceViewModel["evidence"]["profile"];
  sources: PersonIntelligenceViewModel["evidence"]["sources"];
}) {
  const hasProfile = Boolean(
    profile.summary ||
      profile.highlights.length ||
      profile.expertise.length ||
      profile.signals.length ||
      profile.sector ||
      profile.location,
  );

  if (!hasProfile) {
    return <p className="evidence-empty">No public context has been synthesized yet.</p>;
  }

  const attributes = (
    [
      profile.role ? { label: "Role", value: profile.role } : null,
      profile.company ? { label: "Company", value: profile.company } : null,
      profile.sector ? { label: "Sector", value: profile.sector } : null,
      profile.location ? { label: "Location", value: profile.location } : null,
    ] as ({ label: string; value: string } | null)[]
  ).filter((attr): attr is { label: string; value: string } => attr !== null);

  return (
    <div className="evidence-profile">
      {profile.summary ? <p className="evidence-profile-summary">{profile.summary}</p> : null}

      {attributes.length ? (
        <div className="evidence-profile-attributes">
          {attributes.map((attr) => (
            <div key={attr.label}>
              <span>{attr.label}</span>
              <strong>{attr.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {profile.expertise.length ? (
        <div className="evidence-profile-tags">
          {profile.expertise.map((item, index) => (
            <span className="evidence-tag" key={listItemKey(item, index)}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {profile.highlights.length ? (
        <div className="evidence-profile-group">
          <strong>Highlights</strong>
          <ul>
            {profile.highlights.map((item, index) => (
              <li key={listItemKey(item, index)}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {profile.signals.length ? (
        <div className="evidence-profile-group">
          <strong>Signals</strong>
          <ul>
            {profile.signals.map((item, index) => (
              <li key={listItemKey(item, index)}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sources.length ? (
        <div className="evidence-profile-sources">
          <span>Synthesized from</span>
          {sources.map((source, index) => (
            <span
              className={`source-status source-${source.provenance}`}
              key={listItemKey(source.sourceName, index)}
            >
              {source.sourceUrl ? (
                <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                  {source.sourceLabel} <ExternalLink size={12} />
                </a>
              ) : (
                source.sourceLabel
              )}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
