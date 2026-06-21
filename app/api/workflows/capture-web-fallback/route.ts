import { POST as postTextCapture } from "@/app/api/capture/text/route";
import { POST as postWebFallback } from "@/app/api/enrich/web/route";
import { resolveRequestUserId } from "@/lib/auth/request";
import { getActiveObjectiveForUser, saveUserObjectiveForUser } from "@/lib/db/store";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString
} from "@/lib/server/http";
import type {
  CaptureAcceptedResponse,
  ObjectiveSaveRequest,
  WebFallbackRequest,
  WebFallbackResponse,
  WorkflowCaptureWebFallbackRequest,
  WorkflowCaptureWebFallbackResponse
} from "@/lib/types";

export const runtime = "nodejs";

function buildObjectiveSeed(
  userId: string,
  body: WorkflowCaptureWebFallbackRequest
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
    constraints: seed?.constraints ?? []
  };
}

function buildWebQuery(body: WorkflowCaptureWebFallbackRequest, rawText: string): string {
  const explicit = body.query?.trim();
  if (explicit) return explicit;
  const composed = [body.name, body.company, body.role].filter(Boolean).join(" ").trim();
  return composed || rawText;
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<WorkflowCaptureWebFallbackRequest>(request);
    const userId = await resolveRequestUserId(body.userId);
    const rawText = requiredString(body.rawText, "rawText");

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

    const captureRequest = new Request("http://workflow.local/api/capture/text", {
      method: "POST",
      body: JSON.stringify({
        userId,
        rawText,
        eventContext: body.eventContext ?? objective.eventContext ?? undefined,
        capturedAt: body.capturedAt
      })
    });
    const captureResponse = await postTextCapture(captureRequest);
    if (!captureResponse.ok) return captureResponse;
    const capture = (await captureResponse.json()) as CaptureAcceptedResponse;

    const webRequestBody: WebFallbackRequest = {
      userId,
      conversationId: capture.conversationId,
      name: body.name,
      company: body.company,
      role: body.role,
      query: buildWebQuery(body, rawText),
      calaAttempted: true,
      allowUncitedClaims: body.allowUncitedClaims === true
    };
    const webRequest = new Request("http://workflow.local/api/enrich/web", {
      method: "POST",
      body: JSON.stringify(webRequestBody)
    });
    const webResponse = await postWebFallback(webRequest);
    if (!webResponse.ok) return webResponse;
    const webFallback = (await webResponse.json()) as WebFallbackResponse;

    const payload: WorkflowCaptureWebFallbackResponse = {
      objective: {
        existed: !objectiveCreated,
        created: objectiveCreated,
        objectiveId: objective.id
      },
      capture,
      webFallback
    };

    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
