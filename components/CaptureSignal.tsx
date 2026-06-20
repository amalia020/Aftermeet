"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  VoiceCaptureAcceptedResponse,
  WorkflowFullFlowResponse,
  WorkflowObjectiveSeed,
  CaptureType,
} from "@/lib/types";

type SubmissionState = "idle" | "submitting" | "success" | "error";
type RecordingState = "idle" | "recording" | "recorded";

interface RealtimeSessionResponse {
  clientSecret: string;
  delay: string;
  language: string;
  model: string;
}

interface RealtimeTranscriptionEvent {
  type?: string;
  delta?: string;
  item_id?: string;
  transcript?: string;
  error?: {
    message?: string;
  };
}

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

function supportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

function audioFileExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function CaptureSignal({
  viewModel,
}: {
  viewModel: CaptureScreenViewModel;
}) {
  const [note, setNote] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureType>("text");
  const [state, setState] = useState<SubmissionState>("idle");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowFullFlowResponse | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const realtimeChannelRef = useRef<RTCDataChannel | null>(null);
  const realtimeItemsRef = useRef<Map<string, string>>(new Map());
  const realtimeItemOrderRef = useRef<string[]>([]);
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null);
  const realtimeTimeoutRef = useRef<number | null>(null);

  const objectiveSeed = useMemo<WorkflowObjectiveSeed | null>(
    () =>
      viewModel.activeObjective
        ? {
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
          }
        : null,
    [viewModel.activeObjective],
  );

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      closeRealtimeConnection();
    };
  }, []);

  const setRealtimeItemTranscript = (itemId: string, transcript: string) => {
    if (!realtimeItemsRef.current.has(itemId)) {
      realtimeItemOrderRef.current.push(itemId);
    }
    realtimeItemsRef.current.set(itemId, transcript);
    const nextTranscript = realtimeItemOrderRef.current
      .map((id) => realtimeItemsRef.current.get(id))
      .filter(Boolean)
      .join(" ")
      .trim();
    setNote(nextTranscript);
  };

  const handleRealtimeEvent = (event: RealtimeTranscriptionEvent) => {
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      const itemId = event.item_id ?? "current";
      const currentTranscript = realtimeItemsRef.current.get(itemId) ?? "";
      setRealtimeItemTranscript(itemId, `${currentTranscript}${event.delta}`);
      setTranscriptStatus("Realtime transcript active");
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      setRealtimeItemTranscript(event.item_id ?? "current", event.transcript);
      setTranscriptStatus("Realtime transcript finalized");
      return;
    }

    if (event.type === "error") {
      setTranscriptStatus(event.error?.message ?? "Realtime transcript paused.");
    }
  };

  const closeRealtimeConnection = (delayMs = 0) => {
    if (realtimeTimeoutRef.current) {
      window.clearTimeout(realtimeTimeoutRef.current);
      realtimeTimeoutRef.current = null;
    }

    const close = () => {
      realtimeChannelRef.current?.close();
      realtimeChannelRef.current = null;
      realtimePeerRef.current?.close();
      realtimePeerRef.current = null;
    };

    if (delayMs > 0) {
      realtimeTimeoutRef.current = window.setTimeout(close, delayMs);
    } else {
      close();
    }
  };

  const connectRealtimeTranscription = async (stream: MediaStream) => {
    const objective = viewModel.activeObjective;
    if (!objective) throw new Error("Create a mission before recording a voice note.");
    if (typeof RTCPeerConnection === "undefined") {
      setTranscriptStatus("Realtime transcript is not supported in this browser.");
      return;
    }

    const tokenResponse = await fetch("/api/realtime/transcription/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: objective.userId }),
    });
    const tokenPayload = (await tokenResponse.json()) as RealtimeSessionResponse | ErrorResponse;
    if (!tokenResponse.ok) {
      const message =
        "message" in tokenPayload
          ? tokenPayload.message
          : "Realtime transcription could not start.";
      throw new Error(message);
    }

    const session = tokenPayload as RealtimeSessionResponse;
    const peer = new RTCPeerConnection();
    realtimePeerRef.current = peer;
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

    const channel = peer.createDataChannel("oai-events");
    realtimeChannelRef.current = channel;
    channel.addEventListener("message", (messageEvent) => {
      try {
        handleRealtimeEvent(JSON.parse(messageEvent.data) as RealtimeTranscriptionEvent);
      } catch {
        setTranscriptStatus("Realtime transcript event could not be read.");
      }
    });
    channel.addEventListener("open", () => {
      setTranscriptStatus(`Realtime transcript active (${session.language})`);
    });
    channel.addEventListener("error", () => {
      setTranscriptStatus("Realtime transcript connection had an error.");
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${session.clientSecret}`,
        "Content-Type": "application/sdp",
      },
    });
    if (!sdpResponse.ok) {
      throw new Error("Realtime transcription WebRTC connection failed.");
    }
    await peer.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text(),
    });
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (realtimeChannelRef.current?.readyState === "open") {
      realtimeChannelRef.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
    closeRealtimeConnection(1500);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("error");
      setError("Voice recording is not supported in this browser.");
      return;
    }

    setCaptureMode("voice");
    setState("idle");
    setError(null);
    setResult(null);
    setAudioBlob(null);
    setNote("");
    setTranscriptStatus(null);
    realtimeItemsRef.current = new Map();
    realtimeItemOrderRef.current = [];
    closeRealtimeConnection();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setState("error");
        setError("The voice note could not be recorded.");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setRecordingState(blob.size > 0 ? "recorded" : "idle");
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      await connectRealtimeTranscription(stream);
      recorder.start();
      setRecordingState("recording");
    } catch (caught) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      closeRealtimeConnection();
      setRecordingState("idle");
      setState("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "Microphone permission was not granted.",
      );
    }
  };

  const handleVoiceButton = async () => {
    if (state === "submitting") return;
    if (recordingState === "recording") {
      stopRecording();
      return;
    }
    await startRecording();
  };

  const runFullFlow = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/workflows/full-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as WorkflowFullFlowResponse | ErrorResponse;

    if (!response.ok) {
      const message =
        "message" in payload
          ? payload.message
          : "The intelligence workflow could not analyze this note.";
      throw new Error(message);
    }

    return payload as WorkflowFullFlowResponse;
  };

  const submitVoiceCapture = async (blob: Blob) => {
    if (!viewModel.activeObjective || !objectiveSeed) {
      throw new Error("Create a mission before capturing a relationship signal.");
    }
    const type = blob.type || "audio/webm";
    const form = new FormData();
    form.set("userId", viewModel.activeObjective.userId);
    form.set(
      "audioFile",
      new File([blob], `relationship-signal.${audioFileExtension(type)}`, { type }),
    );
    if (viewModel.activeObjective.eventContext) {
      form.set("eventContext", viewModel.activeObjective.eventContext);
    }

    const captureResponse = await fetch("/api/capture/voice", {
      method: "POST",
      body: form,
    });
    const capturePayload = (await captureResponse.json()) as
      | VoiceCaptureAcceptedResponse
      | ErrorResponse;

    if (!captureResponse.ok) {
      const message =
        "message" in capturePayload
          ? capturePayload.message
          : "The voice note could not be transcribed.";
      throw new Error(message);
    }

    const voiceCapture = capturePayload as VoiceCaptureAcceptedResponse;
    if (voiceCapture.transcript) {
      setNote(voiceCapture.transcript);
      setTranscriptStatus("OpenAI transcript ready");
    }

    return runFullFlow({
      userId: viewModel.activeObjective.userId,
      conversationId: voiceCapture.conversationId,
      requestId: voiceCapture.requestId,
      eventContext: viewModel.activeObjective.eventContext ?? undefined,
      objectiveSeed,
      captureType: "voice",
      status: "new",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewModel.activeObjective || !objectiveSeed) {
      setState("error");
      setError("Create a mission before capturing a relationship signal.");
      return;
    }
    const rawText = note.trim();
    if (state === "submitting" || recordingState === "recording") return;
    if (!rawText && !(captureMode === "voice" && audioBlob)) return;

    setState("submitting");
    setError(null);

    try {
      const payload =
        captureMode === "voice" && audioBlob
          ? await submitVoiceCapture(audioBlob)
          : await runFullFlow({
          userId: viewModel.activeObjective.userId,
          rawText,
          eventContext: viewModel.activeObjective.eventContext ?? undefined,
          objectiveSeed,
          captureType: captureMode,
          status: "new",
        });

      setResult(payload);
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
  const canSubmit =
    Boolean(viewModel.activeObjective) &&
    !isSubmitting &&
    recordingState !== "recording" &&
    Boolean(note.trim() || (captureMode === "voice" && audioBlob));
  const candidate = result?.extractionHandoff.contactCandidate;
  const recommendation = result?.recommendationPackage.recommendation;
  const draft = result?.recommendationPackage.draft;
  const selectedRoute = result?.recommendationPackage.decisionTrace.chosenRoute;
  const textareaValue = note;

  if (!viewModel.activeObjective) {
    return (
      <section className="screen capture-screen">
        <div className="capture-topline">
          <span className="user-orb user-orb-large">AM</span>
          <span className="capture-mode">Setup required</span>
        </div>
        <article className="attention-card gap-card">
          <div className="section-label">
            <AlertTriangle size={18} />
            <span>No active mission</span>
          </div>
          <p>Create a mission before capturing relationship signals.</p>
          <Link className="primary-action" href="/objective">
            Set mission
          </Link>
        </article>
      </section>
    );
  }

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
          value={textareaValue}
        />
        <div className="capture-actions">
          <button
            aria-label={recordingState === "recording" ? "Stop recording voice note" : "Record voice note"}
            className={`round-tool ${captureMode === "voice" ? "is-active" : ""}`}
            disabled={isSubmitting}
            onClick={handleVoiceButton}
            type="button"
          >
            {recordingState === "recording" ? <Loader2 className="spin-icon" size={24} /> : <Mic size={24} />}
          </button>
          <button
            aria-label="Scan card"
            className={`round-tool ${captureMode === "card" ? "is-active" : ""}`}
            disabled={isSubmitting || recordingState === "recording"}
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
            disabled={!canSubmit}
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
        {captureMode === "voice" && recordingState !== "idle" ? (
          <p className="voice-capture-status" aria-live="polite">
            {recordingState === "recording"
              ? transcriptStatus ?? "Recording voice note"
              : transcriptStatus ?? "Voice transcript ready"}
          </p>
        ) : null}
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
              {result.events.map((event, index) => (
                <span
                  className={`stage-pill stage-${event.status}`}
                  key={`${event.stage}-${event.status}-${event.timestamp}-${index}`}
                >
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
