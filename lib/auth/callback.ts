import { getPostLoginDestination } from "@/lib/frontend/onboarding";

export interface AuthCallbackDestinationInput {
  requestedNext: string | null;
  hasSession: boolean;
  hasObjective: boolean;
}

export function getAuthCallbackDestination(input: AuthCallbackDestinationInput): string {
  if (!input.hasSession) return "/login";
  if (!input.hasObjective) return "/setup";
  if (input.requestedNext && input.requestedNext.startsWith("/") && !input.requestedNext.startsWith("//")) {
    return input.requestedNext;
  }
  return getPostLoginDestination({ hasSession: true, hasObjective: true });
}
