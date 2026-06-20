import { createConversation, getActiveObjective } from "@/lib/db/queries";
import { getServerEnv } from "@/lib/env";
import {
  createRequestId,
  errorResponse,
  HttpError,
  jsonResponse,
  requiredString
} from "@/lib/server/http";
import { isSupportedAudio, transcribeVoiceNote } from "@/lib/providers/whisper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const form = await request.formData();
    const userId = requiredString(form.get("userId"), "userId");
    const audioFile = form.get("audioFile");
    if (!(audioFile instanceof File) || !isSupportedAudio(audioFile)) {
      throw new HttpError(400, "UNSUPPORTED_AUDIO", "A supported audio file is required.");
    }
    const objective = await getActiveObjective(userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    const env = getServerEnv();
    const transcription = await transcribeVoiceNote({
      audioFile,
      languageHint: env.openaiTranscriptionLanguage,
    });
    const eventContext =
      typeof form.get("eventContext") === "string"
        ? String(form.get("eventContext"))
        : objective.eventContext ?? null;
    const capturedAt =
      typeof form.get("capturedAt") === "string" ? String(form.get("capturedAt")) : undefined;

    const conversation = await createConversation({
      userId,
      rawText: transcription.transcript,
      captureType: "voice",
      transcript: transcription.transcript,
      eventContext,
      capturedAt
    });

    return jsonResponse(
      {
        requestId,
        conversationId: conversation.id,
        status: "captured",
        streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(
          conversation.id
        )}&requestId=${encodeURIComponent(requestId)}`,
        transcriptStatus: transcription.transcript ? "completed" : "fallback_required",
        transcript: transcription.transcript
      },
      202
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
