/**
 * Text capture (Part 1, section 7.2). MVP primary path.
 *
 * Validates the raw text, requires an active objective, creates a pending
 * Conversation, and returns a CaptureAcceptedResponse pointing at the streaming
 * process route.
 */

import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getActiveObjective,
  upsertConversation,
} from "@/lib/db/queries";
import { deterministicId } from "@/lib/utils";
import type {
  CaptureAcceptedResponse,
  Conversation,
  ErrorResponse,
  TextCaptureRequest,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_RAW_TEXT = 8000;

export async function POST(request: Request) {
  let body: Partial<TextCaptureRequest>;
  try {
    body = (await request.json()) as Partial<TextCaptureRequest>;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawText = (body.rawText ?? "").trim();
  if (rawText.length === 0) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "rawText is required." },
      { status: 400 },
    );
  }
  if (rawText.length > MAX_RAW_TEXT) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "VALIDATION_ERROR",
        message: `rawText exceeds ${MAX_RAW_TEXT} characters.`,
      },
      { status: 400 },
    );
  }

  const userId = body.userId ?? DEMO_USER_ID;

  if (!getActiveObjective(userId)) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "OBJECTIVE_REQUIRED",
        message: "No active objective. Set a mission before capturing.",
      },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const capturedAt = body.capturedAt ?? now;
  const requestId = deterministicId("req", `${userId}:${capturedAt}:text`);
  const conversationId = deterministicId(
    "conv",
    `${userId}:${capturedAt}:${rawText.slice(0, 64)}`,
  );

  const conversation: Conversation = {
    id: conversationId,
    userId,
    contactId: null,
    rawText,
    captureType: "text",
    transcript: null,
    eventContext: body.eventContext ?? null,
    capturedAt,
    processingStatus: "pending",
  };
  upsertConversation(conversation);

  const response: CaptureAcceptedResponse = {
    requestId,
    conversationId,
    status: "captured",
    streamUrl: `/api/intelligence/process?conversationId=${encodeURIComponent(conversationId)}&requestId=${encodeURIComponent(requestId)}`,
  };
  return NextResponse.json(response, { status: 202 });
}
