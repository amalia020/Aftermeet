import type { ObjectiveSaveRequest } from "@/lib/types";
import { DEMO_USER_ID, getActiveObjective, saveUserObjective } from "@/lib/db/queries";
import { errorResponse, jsonResponse, parseJsonBody, requiredString } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get("userId") ?? DEMO_USER_ID;
    return jsonResponse({ objective: await getActiveObjective(userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<ObjectiveSaveRequest>(request);
    requiredString(body.userId, "userId");
    requiredString(body.role, "role");
    requiredString(body.primaryGoal, "primaryGoal");
    const objective = await saveUserObjective(body);
    return jsonResponse({ objective }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
