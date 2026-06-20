import type { DailyMoveDecision, RelationshipDeltaBreakdown, RelationshipMoveAction, RelationshipMoveInput } from "@/lib/types";

export function urgencyFromPriority(priority: number): DailyMoveDecision["urgency"] {
  if (priority >= 0.75) return "high";
  if (priority >= 0.55) return "medium";
  return "low";
}

export function timingFromScores(
  action: RelationshipMoveAction,
  breakdown: RelationshipDeltaBreakdown
): DailyMoveDecision["suggestedTiming"] {
  if (action === "wait" || action === "snooze" || action === "do_not_act") return "wait";
  if (breakdown.costOfSilence >= 0.28 || breakdown.freshnessBoost >= 0.6) return "today";
  if (breakdown.relationshipWarmth >= 0.35) return "this_week";
  return "later";
}

export function explainMove(input: {
  relationship: RelationshipMoveInput;
  action: RelationshipMoveAction;
  breakdown: RelationshipDeltaBreakdown;
  blockedFacts: string[];
}): Pick<DailyMoveDecision, "whyNow" | "whyThisAction" | "whyNot" | "whatToAvoid" | "risks"> {
  const whyNow: string[] = [];
  const whyThisAction: string[] = [];
  const whyNot: string[] = [];
  const whatToAvoid: string[] = [];
  const risks: string[] = [];

  if (input.breakdown.relationshipWarmth >= 0.45) whyNow.push("The relationship context is still warm.");
  if (input.breakdown.missionImpact >= 0.6) whyNow.push("This relationship maps to your current mission.");
  if (input.breakdown.costOfSilence >= 0.25) whyNow.push("Waiting risks losing useful momentum.");
  if (input.breakdown.evidenceConfidence < 0.45 || input.relationship.evidenceBundle.entityResolution.score < 0.45) {
    whyNow.push("This could matter, but key details need confirmation.");
    risks.push("Identity or evidence is uncertain.");
  }

  if (input.action === "simple_followup") whyThisAction.push("A low-burden follow-up fits the current warmth and clarity.");
  if (input.action === "share_resource") whyThisAction.push("Sharing value first keeps the move useful and low burden.");
  if (input.action === "confirm_details") whyThisAction.push("Confirming details is safer than drafting from uncertain evidence.");
  if (input.action === "wait" || input.action === "snooze") whyThisAction.push("Waiting avoids adding pressure after recent outreach or weak context.");

  if (input.breakdown.pushinessRisk >= 0.55) {
    whyNot.push("A heavier ask would feel too pushy right now.");
    whatToAvoid.push("Do not send another nudge this week.");
  }
  if (input.breakdown.creepinessRisk >= 0.35 || input.blockedFacts.length) {
    whatToAvoid.push("Do not reference public-only facts that were not part of the conversation.");
  }
  if (input.relationship.topOpportunityRoute.type !== "hire") {
    whatToAvoid.push("Do not pitch a formal role yet.");
  }
  if (input.breakdown.recipientBurden >= 0.6) risks.push("Recipient burden is high for the current relationship warmth.");

  return {
    whyNow: whyNow.length ? whyNow : ["No urgent relationship move is needed right now."],
    whyThisAction: whyThisAction.length ? whyThisAction : ["This is the safest useful move for the current context."],
    whyNot,
    whatToAvoid: [...new Set(whatToAvoid)],
    risks
  };
}
