import { resolveRequestUserId } from "@/lib/auth/request";
import { createConversationForUser, getActiveObjectiveForUser } from "@/lib/db/store";
import {
  createRequestId,
  errorResponse,
  HttpError,
  jsonResponse
} from "@/lib/server/http";
import { recognizeBusinessCard, type CardVisionResult } from "@/lib/providers/cardVision";

export const runtime = "nodejs";

async function readCardInput(request: Request): Promise<{
  userId?: string;
  manualTextFallback?: string;
  eventContext?: string;
  imageFile?: File;
  imageRequested: boolean;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      userId: typeof form.get("userId") === "string" ? String(form.get("userId")) : undefined,
      manualTextFallback:
        typeof form.get("manualTextFallback") === "string"
          ? String(form.get("manualTextFallback"))
          : undefined,
      eventContext:
        typeof form.get("eventContext") === "string" ? String(form.get("eventContext")) : undefined,
      imageFile: form.get("imageFile") instanceof File ? (form.get("imageFile") as File) : undefined,
      imageRequested: form.has("imageFile")
    };
  }

  const body = (await request.json()) as {
    userId?: string;
    manualTextFallback?: string;
    eventContext?: string;
    imageFile?: unknown;
  };
  return {
    userId: body.userId,
    manualTextFallback: body.manualTextFallback,
    eventContext: body.eventContext,
    imageFile: undefined,
    imageRequested: Boolean(body.imageFile)
  };
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const input = await readCardInput(request);
    const userId = await resolveRequestUserId(input.userId);
    if (!input.manualTextFallback && !input.imageFile && !input.imageRequested) {
      throw new HttpError(
        400,
        "CARD_INPUT_REQUIRED",
        "Provide a card image or manual text fallback."
      );
    }
    if (!input.manualTextFallback && input.imageRequested && !input.imageFile) {
      throw new HttpError(
        422,
        "CARD_FALLBACK_REQUIRED",
        "Card image upload requires multipart/form-data or manual text fallback."
      );
    }
    if (input.imageFile && (!input.imageFile.type.startsWith("image/") || input.imageFile.size > 10 * 1024 * 1024)) {
      throw new HttpError(400, "INVALID_CARD_IMAGE", "Provide an image file no larger than 10 MB.");
    }
    const objective = await getActiveObjectiveForUser(userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    let recognition: CardVisionResult | undefined;
    if (input.imageFile) {
      try {
        recognition = await recognizeBusinessCard({ imageFile: input.imageFile });
      } catch (error) {
        if (!input.manualTextFallback) {
          throw new HttpError(
            422,
            "CARD_FALLBACK_REQUIRED",
            error instanceof Error ? error.message : "Card recognition failed; provide manual text fallback."
          );
        }
      }
    }

    const cardText = [recognition?.rawText, input.manualTextFallback]
      .filter((value): value is string => Boolean(value?.trim()))
      .join("\n\nMeeting context:\n");
    const conversation = await createConversationForUser({
      userId,
      rawText: cardText,
      captureType: "card",
      eventContext: input.eventContext ?? objective.eventContext ?? null
    });

    return jsonResponse(
      {
        requestId,
        conversationId: conversation.id,
        status: "captured",
        streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(
          conversation.id
        )}&requestId=${encodeURIComponent(requestId)}`,
        cardText,
        cardStatus: recognition ? "captured" : "manual_fallback",
        contactCandidate: recognition?.contactCandidate,
        recognitionProvider: recognition?.provider,
        recognitionModel: recognition?.model,
        warnings: recognition?.warnings ?? []
      },
      202
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
