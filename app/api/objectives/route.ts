/**
 * Objective persistence (Part 1, Phase 3 / section 7.1).
 *
 * POST: accept a UserObjectiveProfileInput, stamp id/timestamps, upsert, return
 *       the saved profile.
 * GET:  return the active objective for the demo user (or null).
 */

import { NextResponse } from "next/server";
import {
  DEMO_USER_ID,
  getActiveObjective,
  upsertObjective,
} from "@/lib/db/queries";
import { deterministicId } from "@/lib/utils";
import type {
  ErrorResponse,
  UserGoal,
  UserObjectiveProfile,
  UserObjectiveProfileInput,
} from "@/lib/types";

export const runtime = "nodejs";

function badRequest(
  message: string,
  details?: Record<string, string>,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: "VALIDATION_ERROR", message, details },
    { status: 400 },
  );
}

export async function GET() {
  const objective = getActiveObjective(DEMO_USER_ID) ?? null;
  return NextResponse.json({ objective });
}

export async function POST(request: Request) {
  let body: Partial<UserObjectiveProfileInput>;
  try {
    body = (await request.json()) as Partial<UserObjectiveProfileInput>;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Request body must be an objective profile object.");
  }

  if (!body.role) {
    return badRequest("role is required.", { field: "role" });
  }
  if (!body.primaryGoal) {
    return badRequest("primaryGoal is required.", { field: "primaryGoal" });
  }

  const userId = body.userId ?? DEMO_USER_ID;
  const now = new Date().toISOString();

  const secondaryGoals: UserGoal[] = body.secondaryGoals ?? [];
  const activeGoals: UserGoal[] =
    body.activeGoals ??
    Array.from(new Set<UserGoal>([body.primaryGoal, ...secondaryGoals]));

  const existing = getActiveObjective(userId);
  const id = existing?.id ?? deterministicId("obj", userId);

  const profile: UserObjectiveProfile = {
    id,
    userId,
    role: body.role,
    primaryGoal: body.primaryGoal,
    secondaryGoals,
    activeGoals,
    eventContext: body.eventContext ?? null,
    companyName: body.companyName ?? null,
    companyStage: body.companyStage ?? null,
    productDescription: body.productDescription ?? null,
    targetCustomer: body.targetCustomer ?? null,
    currentTraction: body.currentTraction ?? null,
    fundraisingStatus: body.fundraisingStatus ?? null,
    hiringNeeds: body.hiringNeeds ?? [],
    attentionBudgetToday:
      typeof body.attentionBudgetToday === "number"
        ? Math.max(0, Math.trunc(body.attentionBudgetToday))
        : 5,
    preferredTone: body.preferredTone ?? "warm",
    constraints: body.constraints ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const saved = upsertObjective(profile);
  return NextResponse.json(saved, { status: 200 });
}
