"use client";

/**
 * PersonView (Part 4) — one person, in full and calm. Shows who they are, the
 * conversation atoms, the public context with its source register, the decision
 * trace + draft, and follow-up history. No leaderboard / grading language: this
 * is a record, not a score of a human.
 *
 * Built from PersonViewModel (recommendation package + evidence bundle). An
 * optional ExtractionHandoff supplies the structured conversation atoms.
 */

import { useState } from "react";
import type {
  ExtractionHandoff,
  Outcome,
  PersonViewModel,
} from "@/lib/types";
import { relativeTime } from "@/lib/frontend/formatting";
import { recordOutcome } from "@/lib/frontend/apiClient";
import { Panel, Pill, EmptyState } from "./primitives";
import { ConversationAtomsView } from "./ConversationAtomsView";
import { SourceRegister } from "./SourceRegister";
import { DecisionTrace } from "./DecisionTrace";

export interface PersonViewProps {
  viewModel: PersonViewModel;
  /** Optional handoff for the structured atoms + candidate details. */
  handoff?: ExtractionHandoff;
  /** Prior outcomes for this contact (follow-up history). */
  history?: Outcome[];
  demoMode?: boolean;
}

export function PersonView({
  viewModel,
  handoff,
  history = [],
  demoMode = true,
}: PersonViewProps) {
  const pkg = viewModel.recommendationPackage;
  const bundle = viewModel.evidenceBundle;
  const [marking, setMarking] = useState(false);
  const [markedSent, setMarkedSent] = useState(false);

  if (viewModel.state === "empty" && !pkg && !bundle && !handoff) {
    return (
      <EmptyState
        title="Nothing recorded for this contact yet"
        body="Capture a conversation with this person to build their record."
      />
    );
  }

  const candidate = bundle?.contactCandidate ?? handoff?.contactCandidate;
  const name =
    candidate?.name ?? pkg?.boardCard.contactName ?? "Unnamed contact";
  const role = candidate?.role ?? null;
  const company = candidate?.company ?? pkg?.boardCard.company ?? null;

  const markSent = async () => {
    if (!pkg) return;
    setMarking(true);
    if (!demoMode) {
      await recordOutcome({
        contactId: viewModel.contactId,
        recommendationId: pkg.recommendation.id,
        outcomeType: "sent",
      });
    }
    setMarking(false);
    setMarkedSent(true);
  };

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-cloud">{name}</h1>
            <p className="mt-0.5 text-sm text-cloud-dim">
              {[role, company].filter(Boolean).join(" · ") || "No details captured"}
            </p>
          </div>
          {bundle?.entityResolution ? (
            <div className="text-right">
              <Pill
                tone={
                  bundle.entityResolution.label === "high"
                    ? "go"
                    : bundle.entityResolution.label === "medium"
                      ? "calm"
                      : "neutral"
                }
              >
                {bundle.entityResolution.label} identity match
              </Pill>
              {bundle.entityResolution.needsUserConfirmation ? (
                <p className="mt-1 text-[11px] text-signal-warm">Confirm this is the right person</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {markedSent ? (
          <p className="mt-3 text-xs text-signal-go">Marked as sent. Nice.</p>
        ) : null}
      </div>

      {/* Conversation atoms */}
      {handoff ? (
        <Panel title="Conversation" subtitle="What was actually said">
          <ConversationAtomsView atoms={handoff.atoms} />
        </Panel>
      ) : null}

      {/* Public context + source register */}
      {bundle ? (
        <Panel title="Public context" subtitle="Verified facts and where they came from">
          {bundle.publicContext.length ? (
            <ul className="mb-4 space-y-1.5">
              {bundle.evidenceFacts.map((fact) => (
                <li
                  key={fact.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-ink-line bg-ink-soft/30 px-3 py-2 text-sm text-cloud"
                >
                  <span>{fact.fact}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {!fact.safeForDraft ? <Pill tone="warm">Not for outreach</Pill> : null}
                    <span className="font-mono text-[11px] text-cloud-faint">
                      {(fact.factConfidence * 100).toFixed(0)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-cloud-faint">
              No public context was available for this contact — only the conversation was used.
            </p>
          )}
          <SourceRegister sources={bundle.sourceRecords} enrichment={bundle.enrichment} />
        </Panel>
      ) : null}

      {/* Decision trace + draft */}
      {pkg ? (
        <DecisionTrace
          pkg={pkg}
          onMarkSent={markSent}
          markingSent={marking}
        />
      ) : null}

      {/* Follow-up history */}
      <Panel title="Follow-up history">
        {history.length ? (
          <ul className="divide-y divide-ink-line/60 overflow-hidden rounded-lg border border-ink-line">
            {history.map((outcome) => (
              <li
                key={outcome.id}
                className="flex items-center justify-between gap-3 bg-ink-soft/30 px-3 py-2 text-sm"
              >
                <span className="capitalize text-cloud">
                  {outcome.outcomeType.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-cloud-faint">{relativeTime(outcome.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-cloud-faint">
            No follow-up actions recorded yet. When you send, reply, or book, it shows here.
          </p>
        )}
      </Panel>
    </div>
  );
}
