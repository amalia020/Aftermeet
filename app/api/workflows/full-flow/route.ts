import { POST as postTextCapture } from "@/app/api/capture/text/route";
import { resolveRequestUserId } from "@/lib/auth/request";
import { getActiveObjectiveForUser, saveUserObjectiveForUser } from "@/lib/db/store";
import { processConversation } from "@/lib/intelligence/process";
import { recommendNextAction } from "@/lib/intelligence/recommend";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString,
} from "@/lib/server/http";
import type {
  CaptureAcceptedResponse,
  ObjectiveSaveRequest,
  WorkflowFullFlowRequest,
  WorkflowFullFlowResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildObjectiveSeed(
  userId: string,
  body: WorkflowFullFlowRequest,
): ObjectiveSaveRequest {
  const seed = body.objectiveSeed;
  const primaryGoal = seed?.primaryGoal ?? "find_users";
  return {
    userId,
    role: seed?.role ?? "founder",
    primaryGoal,
    activeGoals: seed?.activeGoals?.length ? seed.activeGoals : [primaryGoal],
    secondaryGoals: seed?.secondaryGoals ?? [],
    eventContext: seed?.eventContext ?? body.eventContext ?? "MEGATHON",
    companyName: seed?.companyName ?? "AfterMeet",
    productDescription:
      seed?.productDescription ??
      "A goal-conditioned relationship intelligence layer for networking events.",
    targetCustomer: seed?.targetCustomer ?? "Event-heavy founders and operators",
    attentionBudgetToday: seed?.attentionBudgetToday ?? 5,
    preferredTone: seed?.preferredTone ?? "warm",
    constraints: seed?.constraints ?? [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<WorkflowFullFlowRequest>(request);
    const userId = await resolveRequestUserId(body.userId);
    const rawText = requiredString(body.rawText, "rawText");
    const captureType = body.captureType ?? "text";

    const ensureObjective = body.ensureObjective !== false;
    let objective = await getActiveObjectiveForUser(userId);
    let objectiveCreated = false;
    if (!objective) {
      if (!ensureObjective) {
        throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
      }
      objective = await saveUserObjectiveForUser(buildObjectiveSeed(userId, body));
      objectiveCreated = true;
    }

    const captureResponse = await postTextCapture(
      new Request("http://workflow.local/api/capture/text", {
        method: "POST",
        body: JSON.stringify({
          userId,
          rawText,
          eventContext: body.eventContext ?? objective.eventContext ?? undefined,
          capturedAt: body.capturedAt,
        }),
      }),
    );
    if (!captureResponse.ok) return captureResponse;
    const capture = (await captureResponse.json()) as CaptureAcceptedResponse;

    const processed = await processConversation({
      requestId: capture.requestId,
      userId,
      conversationId: capture.conversationId,
      captureType,
      rawText,
      transcript: captureType === "voice" ? rawText : undefined,
      cardText: captureType === "card" ? rawText : undefined,
      eventContext: body.eventContext ?? objective.eventContext ?? undefined,
    });

    const recommendationPackage = await recommendNextAction({
      evidenceBundle: processed.evidenceBundle,
      objective,
      status: body.status,
      hoursSinceLastAction: body.hoursSinceLastAction,
      now: new Date(),
    });

    const payload: WorkflowFullFlowResponse = {
      objective: {
        existed: !objectiveCreated,
        created: objectiveCreated,
        objectiveId: objective.id,
      },
      capture,
      extractionHandoff: processed.extractionHandoff,
      evidenceBundle: processed.evidenceBundle,
      recommendationPackage,
      events: processed.events,
    };

    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
