export interface PostLoginDestinationInput {
  hasSession: boolean;
  hasObjective: boolean;
}

export function getRootDestination(): string {
  return "/login";
}

export function getPostLoginDestination(input: PostLoginDestinationInput): string {
  if (!input.hasSession) return "/login";
  if (!input.hasObjective) return "/setup";
  return "/today";
}

export function getLoginRedirectDestination(input: PostLoginDestinationInput): string | null {
  if (!input.hasSession) return null;
  return getPostLoginDestination(input);
}
