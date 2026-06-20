import type { RelationshipMoveAction, RelationshipMoveInput, RelationshipState } from "@/lib/types";
import { ROUTE_ACTIONS } from "./constants";

export function generateCandidateActions(input: {
  relationship: RelationshipMoveInput;
  relationshipState: RelationshipState;
  evidenceConfidence: number;
  nextStepClarity: number;
}): RelationshipMoveAction[] {
  if (input.evidenceConfidence < 0.45 || input.relationship.evidenceBundle.entityResolution.score < 0.45) {
    return ["confirm_details", "add_context", "wait"];
  }
  if (input.relationshipState === "waiting") return ["wait", "snooze"];
  if (input.nextStepClarity < 0.4) return ["add_context", "simple_followup", "wait"];
  return [...(ROUTE_ACTIONS[input.relationship.topOpportunityRoute.type] ?? ROUTE_ACTIONS.other)];
}
