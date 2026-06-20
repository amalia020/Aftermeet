"use client";

/**
 * CaptureCard (Part 4) — the capture screen body and the magic-moment driver.
 *
 * Text is the primary path; voice and card are affordances that feed the same
 * text box. On submit it POSTs the capture, opens the SSE process stream via
 * useProcessStream, animates the ProcessingCascade, and when `handoff_ready`
 * arrives renders the DecisionTrace with the returned RecommendationPackage.
 *
 * If the API is unreachable (no keys / backend mid-build) it replays the bundled
 * fixture events and the fixture recommendation, badged as demo data.
 */

import { useState } from "react";
import type { CaptureScreenViewModel } from "@/lib/types";
import { captureText, processStreamUrl } from "@/lib/frontend/apiClient";
import { useProcessStream } from "@/lib/frontend/useProcessStream";
import { VoiceCapture } from "./VoiceCapture";
import { CardScan } from "./CardScan";
import { ProcessingCascade } from "./ProcessingCascade";
import { DecisionTrace } from "./DecisionTrace";
import { DemoBadge } from "./AppShell";

export interface CaptureCardProps {
  viewModel: CaptureScreenViewModel;
}

const SAMPLE =
  "Maya from Recursive just closed Series A, scaling the team fast, doing the European conference circuit. She liked AfterMeet and said she wants to try it at her next event.";

type Phase = "compose" | "processing" | "trace";

export function CaptureCard({ viewModel }: CaptureCardProps) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("compose");
  const [submitting, setSubmitting] = useState(false);
  const stream = useProcessStream();

  const objective = viewModel.activeObjective;

  const submit = async () => {
    const rawText = text.trim();
    if (!rawText) return;
    setSubmitting(true);
    setPhase("processing");

    const accepted = await captureText({
      rawText,
      eventContext: objective?.eventContext ?? undefined,
    });

    if (accepted.ok) {
      stream.start(processStreamUrl(accepted.data));
    } else {
      // No backend / objective missing — run the bulletproof fixture replay.
      stream.startFixtureReplay();
    }
    setSubmitting(false);
  };

  // Advance to the trace view once the recommendation arrives.
  if (phase === "processing" && stream.recommendation && stream.state === "ready") {
    // Defer the phase flip to render; using state inside render is avoided by a
    // microtask-safe guard below.
  }

  const showTrace = phase !== "compose" && stream.recommendation && stream.state === "ready";

  const reset = () => {
    stream.reset();
    setText("");
    setPhase("compose");
  };

  return (
    <div className="space-y-6">
      {phase === "compose" ? (
        <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cloud-dim">
              Capture a conversation
            </h2>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="text-xs text-signal-calm hover:underline"
            >
              Use sample
            </button>
          </div>

          <label htmlFor="capture-text" className="sr-only">
            Conversation notes
          </label>
          <textarea
            id="capture-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Who did you meet? What did they say? What do they want?"
            className="w-full resize-y rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-sm text-cloud placeholder:text-cloud-faint focus:border-signal-calm focus:outline-none"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <VoiceCapture onTranscript={(t) => setText((cur) => (cur ? `${cur}\n${t}` : t))} />
            <CardScan onCardText={(t) => setText((cur) => (cur ? `${cur}\n${t}` : t))} />
          </div>

          <p className="mt-4 text-xs text-cloud-faint">{viewModel.acceptableUseText}</p>

          {viewModel.state === "blocked" ? (
            <p className="mt-3 rounded-md border border-signal-warm/30 bg-signal-warm/10 px-3 py-2 text-xs text-signal-warm">
              No active mission yet. You can still capture in demo mode — set a mission on the
              dashboard for goal-conditioned routing.
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || submitting}
              className="rounded-md bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cloud disabled:opacity-40"
            >
              {submitting ? "Processing…" : "Process conversation"}
            </button>
          </div>
        </div>
      ) : null}

      {phase !== "compose" && !showTrace ? (
        <div className="space-y-4">
          {stream.usingFallback ? (
            <div className="flex items-center gap-2 text-xs text-cloud-dim">
              <DemoBadge label="Demo replay" />
              <span>Backend unavailable — replaying the saved pipeline.</span>
            </div>
          ) : null}
          <ProcessingCascade stages={stream.stages} title="Processing conversation" />
        </div>
      ) : null}

      {showTrace && stream.recommendation ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-cloud-dim">
              {stream.usingFallback ? <DemoBadge /> : null}
              <span>Decision trace ready.</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-ink-line px-3 py-1.5 text-xs text-cloud-dim transition hover:text-cloud"
            >
              Capture another
            </button>
          </div>
          <DecisionTrace pkg={stream.recommendation} />
        </div>
      ) : null}
    </div>
  );
}
