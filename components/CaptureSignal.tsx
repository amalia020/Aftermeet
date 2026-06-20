"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Radio,
  ScanLine,
} from "lucide-react";
import type {
  CaptureScreenViewModel,
  ErrorResponse,
  WorkflowFullFlowResponse,
  WorkflowObjectiveSeed,
  CaptureType,
} from "@/lib/types";

type SubmissionState = "idle" | "submitting" | "success" | "error";

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function CaptureSignal({
  viewModel,
}: {
  viewModel: CaptureScreenViewModel;
}) {
  const [note, setNote] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureType>("text");
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowFullFlowResponse | null>(null);

  const objectiveSeed = useMemo<WorkflowObjectiveSeed>(
    () => ({
      role: viewModel.activeObjective.role,
      primaryGoal: viewModel.activeObjective.primaryGoal,
      activeGoals: viewModel.activeObjective.activeGoals,
      secondaryGoals: viewModel.activeObjective.secondaryGoals,
      eventContext: viewModel.activeObjective.eventContext ?? undefined,
      companyName: viewModel.activeObjective.companyName ?? undefined,
      productDescription:
        viewModel.activeObjective.productDescription ?? undefined,
      targetCustomer: viewModel.activeObjective.targetCustomer ?? undefined,
      attentionBudgetToday: viewModel.activeObjective.attentionBudgetToday,
      preferredTone: viewModel.activeObjective.preferredTone,
      constraints: viewModel.activeObjective.constraints,
    }),
    [viewModel.activeObjective],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawText = note.trim();
    if (!rawText || state === "submitting") return;

    setState("submitting");
    setError(null);

    try {
      const response = await fetch("/api/workflows/full-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewModel.activeObjective.userId,
          rawText,
          eventContext: viewModel.activeObjective.eventContext ?? undefined,
          objectiveSeed,
          captureType: captureMode,
          status: "new",
        }),
      });
      const payload = (await response.json()) as
        | WorkflowFullFlowResponse
        | ErrorResponse;

      if (!response.ok) {
        const message =
          "message" in payload
            ? payload.message
            : "The intelligence workflow could not analyze this note.";
        throw new Error(message);
      }

      setResult(payload as WorkflowFullFlowResponse);
      setState("success");
    } catch (caught) {
      setResult(null);
      setState("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "The intelligence workflow could not analyze this note.",
      );
    }
  };

  const isSubmitting = state === "submitting";
  const candidate = result?.extractionHandoff.contactCandidate;
  const recommendation = result?.recommendationPackage.recommendation;
  const draft = result?.recommendationPackage.draft;
  const selectedRoute = result?.recommendationPackage.decisionTrace.chosenRoute;

  return (
    <section className="screen capture-screen">
      <div className="capture-topline">
        <span className="user-orb user-orb-large">AM</span>
        <span className="capture-mode">
          {captureMode === "voice"
            ? "Voice note"
            : captureMode === "card"
              ? "Card note"
              : "Field note"}
        </span>
      </div>
      <form className="capture-composer" onSubmit={handleSubmit}>
        <div>
          <div className="screen-kicker">Recruit Core Talent</div>
          <h1>Add relationship signal</h1>
        </div>
        <textarea
          aria-label="Relationship note"
          disabled={isSubmitting}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            captureMode === "card"
              ? "Paste the card text plus any meeting context: name, role, company, what you discussed..."
              : captureMode === "voice"
                ? "Paste or dictate the voice note transcript from the conversation..."
                : "Met Elena after the AI infra panel. She is scaling distributed systems, open to technical conversations..."
          }
          value={note}
        />
        <div className="capture-actions">
          <button
            aria-label="Record voice note"
            className={`round-tool ${captureMode === "voice" ? "is-active" : ""}`}
            disabled={isSubmitting}
            onClick={() =>
              setCaptureMode((mode) => (mode === "voice" ? "text" : "voice"))
            }
            type="button"
          >
            <Mic size={24} />
          </button>
          <button
            aria-label="Scan card"
            className={`round-tool ${captureMode === "card" ? "is-active" : ""}`}
            disabled={isSubmitting}
            onClick={() =>
              setCaptureMode((mode) => (mode === "card" ? "text" : "card"))
            }
            type="button"
          >
            <ScanLine size={23} />
          </button>
          <button
            aria-busy={isSubmitting}
            className="primary-action capture-submit"
            disabled={!note.trim() || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <Loader2 className="spin-icon" size={18} />
            ) : (
              <Radio size={18} />
            )}
            <span>{isSubmitting ? "Analyzing" : "Analyze relationship"}</span>
          </button>
        </div>
        <p className="quiet-note">{viewModel.acceptableUseText}</p>

        {state === "error" && error ? (
          <article className="analysis-alert" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </article>
        ) : null}

        {result && recommendation ? (
          <section className="analysis-result" aria-live="polite">
            <div className="section-label">
              <CheckCircle2 size={17} />
              <span>Intelligence package</span>
            </div>
            <div className="result-grid">
              <article>
                <span>Contact</span>
                <strong>{candidate?.name ?? "Unknown contact"}</strong>
                <small>
                  {[candidate?.role, candidate?.company]
                    .filter(Boolean)
                    .join(" at ") || "Captured from note"}
                </small>
              </article>
              <article>
                <span>Action</span>
                <strong>{formatAction(recommendation.recommendedAction)}</strong>
                <small>
                  Confidence {formatScore(recommendation.confidence)}
                </small>
              </article>
              <article>
                <span>Route</span>
                <strong>{selectedRoute?.type ?? "relationship"}</strong>
                <small>
                  Priority {formatScore(recommendation.priorityScore)}
                </small>
              </article>
            </div>
            <div className="reason-stack">
              {recommendation.explanation.whyThisAction
                .slice(0, 3)
                .map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
            </div>
            {draft ? (
              <div className="draft-panel captured-draft">
                <div className="draft-title">
                  <span>Generated draft</span>
                </div>
                <textarea
                  aria-label="Generated follow-up draft"
                  readOnly
                  value={draft.body}
                />
              </div>
            ) : null}
            <div className="stage-strip" aria-label="Workflow stages">
              {result.events.map((event) => (
                <span className={`stage-pill stage-${event.status}`} key={`${event.stage}-${event.timestamp}`}>
                  {event.stage.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </form>
    </section>
  );
}
