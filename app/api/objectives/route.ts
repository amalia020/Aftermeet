import type { ObjectiveSaveRequest } from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/db/queries";
import { resolveRequestUserId } from "@/lib/auth/request";
import { getActiveObjectiveForUser, saveUserObjectiveForUser } from "@/lib/db/store";
import { errorResponse, jsonResponse, parseJsonBody, requiredString } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await resolveRequestUserId(new URL(request.url).searchParams.get("userId") ?? DEMO_USER_ID);
    return jsonResponse({ objective: await getActiveObjectiveForUser(userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<ObjectiveSaveRequest>(request);
    const userId = await resolveRequestUserId(body.userId);
    requiredString(body.role, "role");
    requiredString(body.primaryGoal, "primaryGoal");
    const objective = await saveUserObjectiveForUser({ ...body, userId });
    return jsonResponse({ objective }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
