/**
 * POST /api/draft/generate (Phase 15-16).
 *
 * Loads an existing recommendation, re-runs the draft gate against the contact's
 * evidence facts, and regenerates an editable draft with the requested tone.
 * Never auto-sends. Server-only (nodejs).
 *
 * Errors:
 *  403 DRAFT_NOT_ALLOWED          action does not imply a message
 *  404 RECOMMENDATION_NOT_FOUND   no recommendation for this user
 *  422 NO_SAFE_FACTS              no facts pass the draft gate
 *  502 DRAFT_PROVIDER_UNAVAILABLE provider failed (demo fixture may be used)
 */

import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getContact,
  getActiveObjective,
  getRecommendation,
  listEvidenceFacts,
  saveDraft,
} from "@/lib/db/queries";
import { actionImpliesMessage } from "@/lib/intelligence/actionPolicy";
import { factsAllowedInDraft } from "@/lib/intelligence/draftPolicy";
import { generateDraft } from "@/lib/intelligence/draftGeneration";
import { part1DemoObjective } from "@/lib/demo/savedExamples";
import { part2DemoEvidenceBundle } from "@/lib/demo/fixtures";
import type {
  DraftGenerateRequest,
  DraftGenerateResponse,
  ErrorResponse,
  EvidenceFact,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Partial<DraftGenerateRequest>;
  try {
    body = (await request.json()) as Partial<DraftGenerateRequest>;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.recommendationId) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "recommendationId is required." },
      { status: 400 },
    );
  }

  const userId = body.userId ?? DEMO_USER_ID;
  const recommendation = getRecommendation(body.recommendationId);
  if (!recommendation || recommendation.userId !== userId) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "RECOMMENDATION_NOT_FOUND",
        message: "Recommendation does not exist for this user.",
      },
      { status: 404 },
    );
  }

  if (!actionImpliesMessage(recommendation.recommendedAction)) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "DRAFT_NOT_ALLOWED",
        message: `Action ${recommendation.recommendedAction} does not permit a draft.`,
      },
      { status: 403 },
    );
  }

  const contact = getContact(recommendation.contactId);
  const objective = getActiveObjective(userId) ?? part1DemoObjective;

  // Pull facts for this contact; fall back to the demo bundle facts.
  let facts: EvidenceFact[] = listEvidenceFacts(recommendation.contactId);
  if (facts.length === 0) facts = part2DemoEvidenceBundle.evidenceFacts;
  const safeFacts = factsAllowedInDraft(facts);

  if (safeFacts.length === 0) {
    return NextResponse.json<ErrorResponse>(
      { error: "NO_SAFE_FACTS", message: "No facts are allowed in a draft." },
      { status: 422 },
    );
  }

  const tone = body.tone ?? objective.preferredTone;
  const draft = await generateDraft({
    recommendationId: recommendation.id,
    contactId: recommendation.contactId,
    objective,
    contact: contact ?? part2DemoEvidenceBundle.contactCandidate,
    action: recommendation.recommendedAction,
    factsAllowedInDraft: safeFacts,
    whyThis: recommendation.explanation.whyThisAction,
    recipientBurden: recommendation.recipientBurden,
    tone,
    now: new Date(),
  });

  saveDraft(draft);

  const response: DraftGenerateResponse = {
    draft,
    factsUsed: draft.factsUsed,
    riskNote: draft.riskNote ?? null,
  };
  return NextResponse.json(response, { status: 200 });
}
