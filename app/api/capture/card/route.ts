import { createConversation, getActiveObjective } from "@/lib/db/queries";
import {
  createRequestId,
  errorResponse,
  HttpError,
  jsonResponse,
  requiredString
} from "@/lib/server/http";

export const runtime = "nodejs";

async function readCardInput(request: Request): Promise<{
  userId: string;
  manualTextFallback?: string;
  eventContext?: string;
  hasImage: boolean;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      userId: requiredString(form.get("userId"), "userId"),
      manualTextFallback:
        typeof form.get("manualTextFallback") === "string"
          ? String(form.get("manualTextFallback"))
          : undefined,
      eventContext:
        typeof form.get("eventContext") === "string" ? String(form.get("eventContext")) : undefined,
      hasImage: form.get("imageFile") instanceof File
    };
  }

  const body = (await request.json()) as {
    userId?: string;
    manualTextFallback?: string;
    eventContext?: string;
    imageFile?: unknown;
  };
  return {
    userId: requiredString(body.userId, "userId"),
    manualTextFallback: body.manualTextFallback,
    eventContext: body.eventContext,
    hasImage: Boolean(body.imageFile)
  };
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const input = await readCardInput(request);
    if (!input.manualTextFallback && !input.hasImage) {
      throw new HttpError(
        400,
        "CARD_INPUT_REQUIRED",
        "Provide a card image or manual text fallback."
      );
    }
    if (!input.manualTextFallback && input.hasImage) {
      throw new HttpError(
        422,
        "CARD_FALLBACK_REQUIRED",
        "Card OCR is disabled in demo mode; provide manual text fallback."
      );
    }
    const objective = await getActiveObjective(input.userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    const conversation = await createConversation({
      userId: input.userId,
      rawText: input.manualTextFallback ?? "",
      captureType: "card",
      eventContext: input.eventContext ?? objective.eventContext ?? null
    });

    return jsonResponse(
      {
        requestId,
        conversationId: conversation.id,
        status: "captured",
        streamUrl: "/api/intelligence/process",
        cardStatus: "manual_fallback"
      },
      202
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
