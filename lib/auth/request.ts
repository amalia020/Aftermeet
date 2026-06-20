import { isSupabaseConfigured } from "@/lib/auth/config";
import { getCurrentAppUser } from "@/lib/auth/server";
import { HttpError } from "@/lib/server/http";

export async function resolveRequestUserId(fallbackUserId?: string | null): Promise<string> {
  if (!isSupabaseConfigured()) {
    if (!fallbackUserId) {
      throw new HttpError(400, "VALIDATION_ERROR", "userId is required.");
    }
    return fallbackUserId;
  }

  const user = await getCurrentAppUser();
  if (!user) {
    throw new HttpError(401, "UNAUTHORIZED", "User session is required.");
  }
  return user.id;
}
