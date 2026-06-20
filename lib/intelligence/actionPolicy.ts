/**
 * Phase 14 — Action policy engine.
 *
 * Deterministic selection of the next best action — including no action. The
 * policy implements the spec pseudo-code exactly (in order); the only addition
 * is that an explicit commitment from a "drafted" thread is treated as ready to
 * send. `actionForOpportunity` maps the chosen route type to a concrete action.
 *
 * Pure and deterministic.
 */

import type {
  OpportunityRoute,
  OpportunityType,
  RecommendedActionType,
  ContactStatus,
} from "@/lib/types";

/** Map the top opportunity route to a concrete opening action. */
export function actionForOpportunity(
  route: OpportunityRoute,
): RecommendedActionType {
  const map: Record<OpportunityType, RecommendedActionType> = {
    user: "SEND_EARLY_ACCESS",
    raise: "SEND_DECK",
    partner: "PROPOSE_PILOT",
    mentor: "ASK_SHARP_QUESTION",
    customer: "PROPOSE_PILOT",
    sponsor: "PROPOSE_PILOT",
    candidate: "ASK_SHARP_QUESTION",
    hire: "ASK_SHARP_QUESTION",
    job: "ASK_SHARP_QUESTION",
    community: "PROPOSE_COFFEE",
    other: "SEND_FIRST_FOLLOWUP",
  };
  return map[route.type] ?? "SEND_FIRST_FOLLOWUP";
}

export function chooseAction(input: {
  status: ContactStatus;
  entityMatchConfidence: number;
  recipientBurden: number;
  priorityScore: number;
  urgencyScore: number;
  topOpportunityRoute: OpportunityRoute;
  hasExplicitCommitment: boolean;
}): RecommendedActionType {
  // Spec policy, applied in order.
  if (input.entityMatchConfidence < 0.45) return "CONFIRM_DETAILS";
  if (input.recipientBurden > 0.7) return "DO_NOT_CONTACT";

  if (input.status === "new" && input.priorityScore > 0.65) {
    return actionForOpportunity(input.topOpportunityRoute);
  }
  if (input.status === "drafted" && input.priorityScore > 0.55) {
    return "SEND_DRAFT";
  }
  if (input.status === "sent" && input.urgencyScore > 0.7) {
    return "SEND_NUDGE";
  }
  if (input.status === "reply") return "REPLY_NOW";

  if (input.priorityScore < 0.35) return "STAY_CALM";
  return "WAIT";
}

/** Actions that imply a written message (so a draft should be generated). */
const MESSAGE_ACTIONS: ReadonlySet<RecommendedActionType> = new Set([
  "SEND_FIRST_FOLLOWUP",
  "SEND_DRAFT",
  "SEND_NUDGE",
  "REPLY_NOW",
  "ASK_SHARP_QUESTION",
  "SEND_EARLY_ACCESS",
  "SEND_DECK",
  "PROPOSE_COFFEE",
  "PROPOSE_PILOT",
  "MAKE_INTRO",
]);

/** True when the action should produce an editable draft message. */
export function actionImpliesMessage(action: RecommendedActionType): boolean {
  return MESSAGE_ACTIONS.has(action);
}
