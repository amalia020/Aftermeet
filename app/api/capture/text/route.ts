import type { TextCaptureRequest } from "@/lib/types";
import { resolveRequestUserId } from "@/lib/auth/request";
import { createConversation, getActiveObjective } from "@/lib/db/queries";
import {
  createRequestId,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString
} from "@/lib/server/http";

export const runtime = "nodejs";

const MAX_RAW_TEXT_LENGTH = 8000;

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const body = await parseJsonBody<TextCaptureRequest>(request);
    const userId = await resolveRequestUserId(body.userId);
    const rawText = requiredString(body.rawText, "rawText");
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      throw new HttpError(400, "VALIDATION_ERROR", "rawText is too long.", {
        rawText: `max ${MAX_RAW_TEXT_LENGTH} characters`
      });
    }
    const objective = await getActiveObjective(userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    const conversation = await createConversation({
      userId,
      rawText,
      captureType: "text",
      eventContext: body.eventContext ?? objective.eventContext ?? null,
      capturedAt: body.capturedAt
    });

    return jsonResponse(
      {
        requestId,
        conversationId: conversation.id,
        status: "captured",
        streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(
          conversation.id
        )}&requestId=${encodeURIComponent(requestId)}`
      },
      202
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
