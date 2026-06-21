/**
 * /api/outcomes (Phase 20-22).
 *
 * POST: record an outcome, update the linked recommendation status, and return
 *       the recomputed TractionSummary.
 * GET:  return the current TractionSummary for the demo user.
 *
 * Server-only (nodejs). Manual control only — outcomes are user-recorded.
 */

import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/auth/request";
import {
  DEMO_USER_ID,
} from "@/lib/db/queries";
import {
  getContactForUser,
  getRecommendationForContactForUser,
  getRecommendationForUser,
  listOutcomesForUser,
  saveOutcomeForUser,
  saveRecommendationForUser,
} from "@/lib/db/store";
import { conversionRatesForType } from "@/lib/intelligence/feedbackLearning";
import { deterministicId } from "@/lib/utils";
import type {
  ActionRecommendation,
  ActionRecommendationStatus,
  ErrorResponse,
  OpportunityType,
  Outcome,
  OutcomeCreateRequest,
  OutcomeCreateResponse,
  OutcomeSummary,
  OutcomeType,
  TractionSummary,
} from "@/lib/types";

export const runtime = "nodejs";

const VALID_OUTCOME_TYPES: ReadonlySet<OutcomeType> = new Set([
  "sent",
  "reply",
  "booked",
  "paid",
  "wtp",
  "ignored",
  "snoozed",
  "marked_not_relevant",
  "manual_override",
]);

const ALL_OPPORTUNITY_TYPES: OpportunityType[] = [
  "raise",
  "hire",
  "user",
  "partner",
  "mentor",
  "candidate",
  "customer",
  "sponsor",
  "job",
  "community",
  "other",
];

/** Map an outcome type onto the recommendation status it implies. */
function statusForOutcome(outcomeType: OutcomeType): ActionRecommendationStatus | undefined {
  switch (outcomeType) {
    case "sent":
      return "sent";
    case "snoozed":
      return "snoozed";
    case "ignored":
    case "marked_not_relevant":
      return "archived";
    case "manual_override":
      return "overridden";
    case "reply":
    case "booked":
    case "paid":
    case "wtp":
      return "accepted";
    default:
      return undefined;
  }
}

/** Compute the proof-metric traction summary from a user's outcomes. */
function computeTraction(outcomes: OutcomeSummary[]): TractionSummary {
  const count = (t: OutcomeType) => outcomes.filter((o) => o.outcomeType === t).length;

  const replyRateByOpportunityType: Partial<Record<OpportunityType, number>> = {};
  for (const type of ALL_OPPORTUNITY_TYPES) {
    const rates = conversionRatesForType(type, outcomes);
    if (rates.total > 0) replyRateByOpportunityType[type] = rates.replyRate;
  }

  const followUpsSent = count("sent");
  const repliesReceived = count("reply");
  const bookedMeetings = count("booked");
  const wtpSignals = count("wtp");
  const paidCommits = count("paid");
  const contactsArchivedOrIgnored =
    count("ignored") + count("marked_not_relevant");
  const actionsCompleted =
    followUpsSent + repliesReceived + bookedMeetings + wtpSignals + paidCommits;

  return {
    followUpsSent,
    repliesReceived,
    bookedMeetings,
    wtpSignals,
    paidCommits,
    replyRateByOpportunityType,
    actionsCompleted,
    contactsArchivedOrIgnored,
  };
}

async function toSummaries(outcomes: Outcome[]): Promise<OutcomeSummary[]> {
  const summaries = await Promise.all(outcomes.map(async (o) => {
    const rec = o.recommendationId ? await getRecommendationForUser(o.recommendationId) : undefined;
    const opportunityType = rec?.explanation.chosenRoute.type;
    return {
      opportunityType,
      outcomeType: o.outcomeType,
      createdAt: o.createdAt,
      value: o.value ?? null,
    } satisfies OutcomeSummary;
  }));
  return summaries;
}

export async function GET() {
  let userId: string;
  try {
    userId = await resolveRequestUserId(DEMO_USER_ID);
  } catch (error) {
    const message = error instanceof Error ? error.message : "User session is required.";
    return NextResponse.json<ErrorResponse>(
      { error: "UNAUTHORIZED", message },
      { status: 401 },
    );
  }
  const outcomes = await listOutcomesForUser(userId);
  const traction = computeTraction(await toSummaries(outcomes));
  return NextResponse.json<TractionSummary>(traction, { status: 200 });
}

export async function POST(request: Request) {
  let body: Partial<OutcomeCreateRequest>;
  try {
    body = (await request.json()) as Partial<OutcomeCreateRequest>;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.contactId) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "contactId is required." },
      { status: 400 },
    );
  }
  if (!body.outcomeType || !VALID_OUTCOME_TYPES.has(body.outcomeType)) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "A valid outcomeType is required." },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    userId = await resolveRequestUserId(body.userId ?? DEMO_USER_ID);
  } catch (error) {
    const message = error instanceof Error ? error.message : "User session is required.";
    return NextResponse.json<ErrorResponse>(
      { error: "UNAUTHORIZED", message },
      { status: 401 },
    );
  }

  // Contact must be accessible (best-effort in the single-tenant demo store).
  const contact = await getContactForUser(body.contactId);
  if (contact && contact.userId !== userId) {
    return NextResponse.json<ErrorResponse>(
      { error: "CONTACT_NOT_FOUND", message: "User cannot access this contact." },
      { status: 404 },
    );
  }

  const nowIso = new Date().toISOString();
  const outcome: Outcome = {
    id: deterministicId("outcome", `${body.contactId}:${body.outcomeType}:${nowIso}`),
    userId,
    contactId: body.contactId,
    recommendationId: body.recommendationId ?? null,
    outcomeType: body.outcomeType,
    notes: body.notes ?? null,
    value: body.value ?? null,
    createdAt: nowIso,
  };
  await saveOutcomeForUser(outcome);

  // Update the linked recommendation status, if any.
  let updatedRecommendation: ActionRecommendation | undefined;
  const rec =
    (body.recommendationId
      ? await getRecommendationForUser(body.recommendationId)
      : undefined) ?? (await getRecommendationForContactForUser(body.contactId));
  if (rec) {
    const nextStatus = statusForOutcome(body.outcomeType);
    if (nextStatus) {
      updatedRecommendation = { ...rec, status: nextStatus };
      await saveRecommendationForUser(updatedRecommendation);
    }
  }

  const traction = computeTraction(await toSummaries(await listOutcomesForUser(userId)));

  const response: OutcomeCreateResponse = {
    outcome,
    updatedRecommendation,
    updatedTraction: traction,
  };
  return NextResponse.json(response, { status: 201 });
}
