/**
 * POST /api/intelligence/recommend (Phase 14-17).
 *
 * Runs the Part 3 decision engine and returns a RecommendationPackage. If no
 * evidenceBundle is supplied, falls back to the demo bundle so the route always
 * works for the demo. Server-only (nodejs). The engine never throws.
 */

import { NextResponse } from "next/server";
import { DEMO_USER_ID, getActiveObjective, getContact } from "@/lib/db/queries";
import { recommendNextAction } from "@/lib/intelligence/recommend";
import { part1DemoObjective } from "@/lib/demo/savedExamples";
import { part2DemoEvidenceBundle } from "@/lib/demo/fixtures";
import type {
  ContactStatus,
  ErrorResponse,
  EvidenceBundle,
  RecommendRequest,
  RecommendResponse,
  UserObjectiveProfile,
} from "@/lib/types";

export const runtime = "nodejs";

interface RecommendRequestExtended extends Partial<RecommendRequest> {
  status?: ContactStatus;
  hoursSinceLastAction?: number;
  objective?: UserObjectiveProfile;
}

export async function POST(request: Request) {
  let body: RecommendRequestExtended;
  try {
    body = (await request.json()) as RecommendRequestExtended;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  const userId = body.userId ?? DEMO_USER_ID;

  // Use the provided bundle, else fall back to the demo bundle.
  const evidenceBundle: EvidenceBundle =
    body.evidenceBundle ?? part2DemoEvidenceBundle;

  // Resolve the objective: explicit > active for user > demo objective.
  const objective: UserObjectiveProfile =
    body.objective ?? getActiveObjective(userId) ?? part1DemoObjective;

  // Best-effort enrich status from the contact if available.
  const contactId = body.contactId ?? evidenceBundle.contactId;
  const contact = contactId ? getContact(contactId) : undefined;
  void contact; // status comes from the request; contact lookup is best-effort.

  const pkg = await recommendNextAction({
    evidenceBundle,
    objective,
    status: body.status,
    hoursSinceLastAction: body.hoursSinceLastAction,
    now: new Date(),
  });

  const response: RecommendResponse = pkg;
  return NextResponse.json(response, { status: 200 });
}
