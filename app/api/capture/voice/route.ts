import { resolveRequestUserId } from "@/lib/auth/request";
import { createConversationForUser, getActiveObjectiveForUser } from "@/lib/db/store";
import {
  createRequestId,
  errorResponse,
  HttpError,
  jsonResponse
} from "@/lib/server/http";
import { isSupportedAudio, transcribeVoiceNote } from "@/lib/providers/whisper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const form = await request.formData();
    const userId = await resolveRequestUserId(
      typeof form.get("userId") === "string" ? String(form.get("userId")) : undefined
    );
    const audioFile = form.get("audioFile");
    if (!(audioFile instanceof File) || !isSupportedAudio(audioFile)) {
      throw new HttpError(400, "UNSUPPORTED_AUDIO", "A supported audio file is required.");
    }
    const objective = await getActiveObjectiveForUser(userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    const transcription = await transcribeVoiceNote({ audioFile });
    const eventContext =
      typeof form.get("eventContext") === "string"
        ? String(form.get("eventContext"))
        : objective.eventContext ?? null;
    const capturedAt =
      typeof form.get("capturedAt") === "string" ? String(form.get("capturedAt")) : undefined;

    const conversation = await createConversationForUser({
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
        transcriptStatus: transcription.transcript ? "completed" : "fallback_required"
      },
      202
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
