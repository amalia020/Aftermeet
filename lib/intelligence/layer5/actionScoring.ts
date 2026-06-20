import type { DailyMoveDecision, RelationshipMoveAction, RelationshipMoveInput } from "@/lib/types";
import { roundScore } from "@/lib/intelligence/utils";
import { computeBreakdown } from "./features";
import { resolveRelationshipState } from "./relationshipState";
import { explainMove, timingFromScores, urgencyFromPriority } from "./explanations";

export function scoreActionForRelationship(
  relationship: RelationshipMoveInput,
  action: RelationshipMoveAction,
  generatedAt: string
): DailyMoveDecision {
  const scored = computeBreakdown(relationship, action, generatedAt);
  const lastOutcome = relationship.outcomeHistory.at(-1)?.outcomeType;
  const relationshipState = resolveRelationshipState({
    hasUserActed: relationship.actionHistory.hasUserActed ?? false,
    hasRecipientReplied: relationship.actionHistory.hasRecipientReplied ?? false,
    relationshipWarmth: scored.breakdown.relationshipWarmth,
    missionImpact: scored.breakdown.missionImpact,
    evidenceConfidence: scored.breakdown.evidenceConfidence,
    uncertaintyPenalty: scored.breakdown.uncertaintyPenalty,
    lastOutcome,
    userArchived: relationship.actionHistory.userArchived ?? false
  });
  const explanation = explainMove({
    relationship,
    action,
    breakdown: scored.breakdown,
    blockedFacts: scored.blockedFacts
  });

  return {
    relationshipId: relationship.relationshipId,
    contactId: relationship.contactId,
    contactName: relationship.contactName ?? relationship.evidenceBundle.contactCandidate.name ?? null,
    company: relationship.company ?? relationship.evidenceBundle.contactCandidate.company ?? null,
    relationshipState,
    recommendedAction: action,
    dailyPriority: scored.breakdown.dailyPriority,
    relationshipDelta: scored.breakdown.relationshipDelta,
    costOfSilence: scored.breakdown.costOfSilence,
    confidence: roundScore(scored.breakdown.evidenceConfidence),
    urgency: urgencyFromPriority(scored.breakdown.dailyPriority),
    suggestedTiming: timingFromScores(action, scored.breakdown),
    safeFactsForDraft: action === "confirm_details" ? [] : scored.safeFactsForDraft,
    blockedFacts: scored.blockedFacts,
    scoreBreakdown: scored.breakdown,
    featureTrace: scored.featureTrace,
    ...explanation
  };
}
