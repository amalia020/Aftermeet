import type { OutcomeType, RelationshipState } from "@/lib/types";

export function resolveRelationshipState(input: {
  hasUserActed: boolean;
  hasRecipientReplied: boolean;
  relationshipWarmth: number;
  missionImpact: number;
  evidenceConfidence: number;
  uncertaintyPenalty: number;
  lastOutcome?: OutcomeType;
  userArchived: boolean;
}): RelationshipState {
  if (input.userArchived) return "archived";
  if (input.lastOutcome === "booked" || input.lastOutcome === "paid" || input.lastOutcome === "wtp") {
    return "converted";
  }
  if (input.evidenceConfidence < 0.45 || input.uncertaintyPenalty > 0.65) return "blocked";
  if (input.hasUserActed && !input.hasRecipientReplied) return "waiting";
  if (input.relationshipWarmth > 0.65 && input.missionImpact > 0.45) return "warm";
  if (input.relationshipWarmth > 0.3 && input.missionImpact > 0.45) return "cooling";
  if (!input.hasUserActed && input.relationshipWarmth > 0.5) return "new";
  return "dormant";
}
