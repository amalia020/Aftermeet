/**
 * Card capture (Part 1, section 7.2).
 *
 * Accepts an image and/or a manual text fallback. OCR is out of scope for the
 * MVP, so when no manual text is supplied we fall back to the demo capture text
 * (cardStatus "manual_fallback"). Stores a card-type Conversation and returns a
 * CardCaptureAcceptedResponse.
 */

import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getActiveObjective,
  upsertConversation,
} from "@/lib/db/queries";
import { deterministicId } from "@/lib/utils";
import { part1DemoRawText } from "@/lib/demo/savedExamples";
import type {
  CardCaptureAcceptedResponse,
  Conversation,
  ErrorResponse,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "CARD_INPUT_REQUIRED", message: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const imageEntry = form.get("imageFile");
  const hasImage = imageEntry instanceof Blob && imageEntry.size > 0;
  const manualText = (
    (form.get("manualTextFallback") as string | null) ?? ""
  ).trim();

  if (!hasImage && manualText.length === 0) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "CARD_INPUT_REQUIRED",
        message: "Provide either an image or manual text fallback.",
      },
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

  // OCR is out of scope for the MVP: prefer manual text, else use the fixture.
  const cardStatus: CardCaptureAcceptedResponse["cardStatus"] =
    manualText.length > 0 ? "captured" : "manual_fallback";
  const rawText = manualText.length > 0 ? manualText : part1DemoRawText;

  const eventContext = (form.get("eventContext") as string | null) ?? null;
  const now = new Date().toISOString();
  const capturedAt = (form.get("capturedAt") as string | null) ?? now;

  const requestId = deterministicId("req", `${userId}:${capturedAt}:card`);
  const conversationId = deterministicId(
    "conv",
    `${userId}:${capturedAt}:card:${rawText.slice(0, 64)}`,
  );

  const conversation: Conversation = {
    id: conversationId,
    userId,
    contactId: null,
    rawText,
    captureType: "card",
    transcript: null,
    eventContext,
    capturedAt,
    processingStatus: "pending",
  };
  upsertConversation(conversation);

  const response: CardCaptureAcceptedResponse = {
    requestId,
    conversationId,
    status: "captured",
    cardStatus,
    streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(conversationId)}&requestId=${encodeURIComponent(requestId)}`,
  };
  return NextResponse.json(response, { status: 202 });
}
