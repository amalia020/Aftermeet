/**
 * Voice capture (Part 1, section 7.2 / ADR-002).
 *
 * Accepts a multipart form with an audio file, transcribes it server-side via
 * the Whisper provider, stores the transcript as the conversation rawText, and
 * returns a VoiceCaptureAcceptedResponse. When transcription falls back to the
 * fixture, transcriptStatus is "fallback_required" so the UI can nudge to text.
 */

import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getActiveObjective,
  upsertConversation,
} from "@/lib/db/queries";
import { transcribeAudio } from "@/lib/providers/whisper";
import { deterministicId } from "@/lib/utils";
import type {
  Conversation,
  ErrorResponse,
  VoiceCaptureAcceptedResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB, OpenAI transcription limit.

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "UNSUPPORTED_AUDIO", message: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const audioEntry = form.get("audioFile") ?? form.get("file");
  if (!(audioEntry instanceof Blob)) {
    return NextResponse.json<ErrorResponse>(
      { error: "UNSUPPORTED_AUDIO", message: "audioFile is required." },
      { status: 400 },
    );
  }
  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return NextResponse.json<ErrorResponse>(
      { error: "UNSUPPORTED_AUDIO", message: "Audio file too large." },
      { status: 400 },
    );
  }

  const userId = (form.get("userId") as string | null) ?? DEMO_USER_ID;
  if (!getActiveObjective(userId)) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "OBJECTIVE_REQUIRED",
        message: "No active objective. Set a mission before capturing.",
      },
      { status: 422 },
    );
  }

  const eventContext = (form.get("eventContext") as string | null) ?? null;
  const now = new Date().toISOString();
  const capturedAt = (form.get("capturedAt") as string | null) ?? now;

  const arrayBuffer = await audioEntry.arrayBuffer();
  const outcome = await transcribeAudio({
    audio: arrayBuffer,
    mimeType: audioEntry.type || undefined,
  });

  const transcript = outcome.data.transcript;
  const transcriptStatus: VoiceCaptureAcceptedResponse["transcriptStatus"] =
    outcome.mode === "live" ? "completed" : "fallback_required";

  const requestId = deterministicId("req", `${userId}:${capturedAt}:voice`);
  const conversationId = deterministicId(
    "conv",
    `${userId}:${capturedAt}:voice:${audioEntry.size}`,
  );

  const conversation: Conversation = {
    id: conversationId,
    userId,
    contactId: null,
    rawText: transcript,
    captureType: "voice",
    transcript,
    eventContext,
    capturedAt,
    processingStatus: "pending",
  };
  upsertConversation(conversation);

  const response: VoiceCaptureAcceptedResponse = {
    requestId,
    conversationId,
    status: "captured",
    transcriptStatus,
    streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(conversationId)}&requestId=${encodeURIComponent(requestId)}`,
  };
  return NextResponse.json(response, { status: 202 });
}
