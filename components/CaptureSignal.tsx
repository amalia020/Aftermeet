"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  Mic,
  Radio,
  ScanLine,
  X,
} from "lucide-react";
import type {
  CaptureScreenViewModel,
  CaptureAcceptedResponse,
  CardCaptureAcceptedResponse,
  EvidenceBundle,
  ErrorResponse,
  ExtractionHandoff,
  ProcessStageEvent,
  RecommendationPackage,
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
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowFullFlowResponse | null>(null);
  const [processEvents, setProcessEvents] = useState<ProcessStageEvent[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cardInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
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
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      closeRealtimeConnection();
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOpen]);

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
    if (!objective) throw new Error("Complete setup before recording a voice note.");
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

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("Camera capture is not supported in this browser. Choose an image instead.");
      cardInputRef.current?.click();
      return;
    }

    setCaptureMode("card");
    setState("idle");
    setError(null);
    setResult(null);
    closeCamera();

    try {
      cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setCameraOpen(true);
    } catch (caught) {
      setState("error");
      setError(
        caught instanceof Error
          ? `Camera could not be opened: ${caught.message}`
          : "Camera permission was not granted."
      );
    }
  };

  const captureCardFrame = async () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setState("error");
      setError("The camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setState("error");
      setError("The camera frame could not be captured.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setState("error");
      setError("The camera frame could not be captured.");
      return;
    }

    setCardImage(new File([blob], `business-card-${Date.now()}.jpg`, { type: "image/jpeg" }));
    closeCamera();
  };

  const consumeProcessStream = async (
    capture: CaptureAcceptedResponse,
  ): Promise<WorkflowFullFlowResponse> => {
    if (!capture.streamUrl) throw new Error("The processing stream is unavailable.");
    const response = await fetch(capture.streamUrl, {
      headers: { Accept: "text/event-stream" },
    });
    if (!response.ok || !response.body) {
      throw new Error("The intelligence workflow could not start.");
    }

    const events: ProcessStageEvent[] = [];
    let finalPayload:
      | (RecommendationPackage & {
          extractionHandoff: ExtractionHandoff;
          evidenceBundle: EvidenceBundle;
        })
      | null = null;
    let buffer = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const readEvent = (block: string) => {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) return;
      const event = JSON.parse(data) as ProcessStageEvent;
      events.push(event);
      setProcessEvents([...events]);
      if (event.stage === "failed") {
        throw new Error(event.message ?? "The intelligence workflow failed.");
      }
      if (event.stage === "handoff_ready" && event.payload) {
        finalPayload = event.payload as unknown as typeof finalPayload;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      blocks.forEach(readEvent);
      if (done) break;
    }
    if (buffer.trim()) readEvent(buffer);
    const completedPayload = finalPayload as
      | (RecommendationPackage & {
          extractionHandoff: ExtractionHandoff;
          evidenceBundle: EvidenceBundle;
        })
      | null;
    if (!completedPayload) throw new Error("The processing stream ended without a result.");

    const { extractionHandoff, evidenceBundle, ...recommendationPackage } = completedPayload;
    return {
      objective: {
        existed: true,
        created: false,
        objectiveId: viewModel.activeObjective?.id ?? "objective",
      },
      capture,
      extractionHandoff,
      evidenceBundle,
      recommendationPackage,
      events,
    };
  };

  const submitTextCapture = async (rawText: string) => {
    if (!viewModel.activeObjective) {
      throw new Error("Complete setup before capturing a relationship signal.");
    }
    const response = await fetch("/api/capture/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: viewModel.activeObjective.userId,
        rawText,
        eventContext: viewModel.activeObjective.eventContext ?? undefined,
      }),
    });
    const payload = (await response.json()) as CaptureAcceptedResponse | ErrorResponse;
    if (!response.ok) {
      throw new Error("message" in payload ? payload.message : "The note could not be captured.");
    }
    return consumeProcessStream(payload as CaptureAcceptedResponse);
  };

  const submitVoiceCapture = async (blob: Blob) => {
    if (!viewModel.activeObjective || !objectiveSeed) {
      throw new Error("Complete setup before capturing a relationship signal.");
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

    return consumeProcessStream(voiceCapture);
  };

  const submitCardCapture = async (imageFile: File, meetingContext: string) => {
    if (!viewModel.activeObjective || !objectiveSeed) {
      throw new Error("Complete setup before capturing a relationship signal.");
    }
    const form = new FormData();
    form.set("userId", viewModel.activeObjective.userId);
    form.set("imageFile", imageFile);
    if (meetingContext) form.set("manualTextFallback", meetingContext);
    if (viewModel.activeObjective.eventContext) {
      form.set("eventContext", viewModel.activeObjective.eventContext);
    }

    const response = await fetch("/api/capture/card", { method: "POST", body: form });
    const payload = (await response.json()) as CardCaptureAcceptedResponse | ErrorResponse;
    if (!response.ok) {
      throw new Error("message" in payload ? payload.message : "The business card could not be recognized.");
    }

    const cardCapture = payload as CardCaptureAcceptedResponse;
    if (cardCapture.cardText) setNote(cardCapture.cardText);
    return consumeProcessStream(cardCapture);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewModel.activeObjective || !objectiveSeed) {
      setState("error");
      setError("Complete setup before capturing a relationship signal.");
      return;
    }
    const rawText = note.trim();
    if (state === "submitting" || recordingState === "recording") return;
    if (!rawText && !(captureMode === "voice" && audioBlob) && !(captureMode === "card" && cardImage)) return;

    setState("submitting");
    setError(null);
    setProcessEvents([]);

    try {
      const payload =
        captureMode === "voice" && audioBlob
          ? await submitVoiceCapture(audioBlob)
          : captureMode === "card" && cardImage
            ? await submitCardCapture(cardImage, rawText)
          : await submitTextCapture(rawText);

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
    Boolean(note.trim() || (captureMode === "voice" && audioBlob) || (captureMode === "card" && cardImage));
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
            <span>Setup required</span>
          </div>
          <p>Complete setup before capturing relationship signals.</p>
          <Link className="primary-action" href="/objective">
            Open setup
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
          <input
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const image = event.target.files?.[0] ?? null;
              setCardImage(image);
              if (image) {
                closeCamera();
                setCaptureMode("card");
                setError(null);
                setResult(null);
              }
            }}
            ref={cardInputRef}
            type="file"
          />
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
            onClick={startCamera}
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
        {captureMode === "card" && cardImage ? (
          <p className="voice-capture-status" aria-live="polite">
            {cardImage.name} ready for recognition
          </p>
        ) : null}
        <p className="quiet-note">{viewModel.acceptableUseText}</p>

        {state === "error" && error ? (
          <article className="analysis-alert" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </article>
        ) : null}

        {cameraOpen ? (
          <div className="camera-overlay" role="dialog" aria-label="Business card camera" aria-modal="true">
            <div className="camera-header">
              <span>Align card within frame</span>
              <button aria-label="Close camera" className="camera-icon-button" onClick={closeCamera} type="button">
                <X size={24} />
              </button>
            </div>
            <div className="camera-viewport">
              <video autoPlay muted playsInline ref={cameraVideoRef} />
              <div className="camera-guide" aria-hidden="true" />
            </div>
            <div className="camera-controls">
              <button
                aria-label="Choose card image"
                className="camera-icon-button"
                onClick={() => cardInputRef.current?.click()}
                title="Choose image"
                type="button"
              >
                <ImageUp size={24} />
              </button>
              <button aria-label="Capture card" className="camera-shutter" onClick={captureCardFrame} type="button">
                <Camera size={30} />
              </button>
              <span className="camera-control-spacer" aria-hidden="true" />
            </div>
          </div>
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
          </section>
        ) : null}
        {processEvents.length ? (
          <div className="stage-strip" aria-label="Workflow stages" aria-live="polite">
            {processEvents.map((event, index) => (
              <span
                className={`stage-pill stage-${event.status}`}
                key={`${event.stage}-${event.status}-${event.timestamp}-${index}`}
              >
                {event.stage.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        ) : null}
      </form>
    </section>
  );
}
