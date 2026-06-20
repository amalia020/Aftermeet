export interface PostLoginDestinationInput {
  hasSession: boolean;
  hasObjective: boolean;
}

export function getPostLoginDestination(input: PostLoginDestinationInput): string {
  if (!input.hasSession) return "/login";
  if (!input.hasObjective) return "/setup";
  return "/";
}
