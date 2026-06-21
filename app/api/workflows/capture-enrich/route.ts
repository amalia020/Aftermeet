import { POST as postTextCapture } from "@/app/api/capture/text/route";
import { POST as postCalaEnrich } from "@/app/api/enrich/cala/route";
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
  CalaEnrichmentRequest,
  CalaEnrichmentResponse,
  CaptureAcceptedResponse,
  ObjectiveSaveRequest,
  WebFallbackRequest,
  WebFallbackResponse,
  WorkflowCaptureEnrichRequest,
  WorkflowCaptureEnrichResponse
} from "@/lib/types";

export const runtime = "nodejs";

function buildObjectiveSeed(
  userId: string,
  body: WorkflowCaptureEnrichRequest
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

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<WorkflowCaptureEnrichRequest>(request);
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

    const calaRequestBody: CalaEnrichmentRequest = {
      userId,
      conversationId: capture.conversationId,
      name: body.name,
      company: body.company,
      role: body.role,
      query: body.query ?? rawText
    };
    const calaRequest = new Request("http://workflow.local/api/enrich/cala", {
      method: "POST",
      body: JSON.stringify(calaRequestBody)
    });
    const calaResponse = await postCalaEnrich(calaRequest);
    if (!calaResponse.ok) return calaResponse;
    const cala = (await calaResponse.json()) as CalaEnrichmentResponse;

    const shouldRunWebFallback =
      body.includeWebFallback === true || (body.includeWebFallback !== false && !cala.available);

    let webFallback: WebFallbackResponse | undefined;
    if (shouldRunWebFallback) {
      const webQuery =
        [body.query, body.name, body.company, body.role].filter(Boolean).join(" ").trim() || rawText;

      const webRequestBody: WebFallbackRequest = {
        userId,
        conversationId: capture.conversationId,
        name: body.name,
        company: body.company,
        role: body.role,
        query: webQuery,
        calaAttempted: true,
        calaMatchConfidence: cala.entityMatchConfidence,
        allowUncitedClaims: body.allowUncitedClaims !== false
      };
      const webRequest = new Request("http://workflow.local/api/enrich/web", {
        method: "POST",
        body: JSON.stringify(webRequestBody)
      });
      const webResponse = await postWebFallback(webRequest);
      if (!webResponse.ok) return webResponse;
      webFallback = (await webResponse.json()) as WebFallbackResponse;
    }

    const payload: WorkflowCaptureEnrichResponse = {
      objective: {
        existed: !objectiveCreated,
        created: objectiveCreated,
        objectiveId: objective.id
      },
      capture,
      cala,
      webFallback
    };

    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
