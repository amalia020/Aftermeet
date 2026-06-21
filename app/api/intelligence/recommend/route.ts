/**
 * POST /api/intelligence/recommend (Phase 14-17).
 *
 * Runs the Part 3 decision engine and returns a RecommendationPackage. If no
 * evidenceBundle is supplied, falls back to the demo bundle so the route always
 * works for the demo. Server-only (nodejs). The engine never throws.
 */

import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/auth/request";
import { getActiveObjectiveForUser, getContactForUser } from "@/lib/db/store";
import { recommendNextAction } from "@/lib/intelligence/recommend";
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

  let userId: string;
  try {
    userId = await resolveRequestUserId(body.userId);
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 401;
    return NextResponse.json<ErrorResponse>(
      { error: "UNAUTHORIZED", message: "User session is required." },
      { status },
    );
  }

  // Use the provided bundle, else fall back to the demo bundle.
  const evidenceBundle: EvidenceBundle =
    body.evidenceBundle ?? part2DemoEvidenceBundle;

  // Resolve the objective: explicit > active for user > demo objective.
  const objective = body.objective ?? (await getActiveObjectiveForUser(userId));
  if (!objective) {
    return NextResponse.json<ErrorResponse>(
      { error: "OBJECTIVE_REQUIRED", message: "No active objective is available." },
      { status: 422 },
    );
  }

  // Best-effort enrich status from the contact if available.
  const contactId = body.contactId ?? evidenceBundle.contactId;
  const contact = contactId ? await getContactForUser(contactId) : undefined;
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
