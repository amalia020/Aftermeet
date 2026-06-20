import type { DailyMoveDecision, DailyMoveSelectorInput, DailyMoveView } from "@/lib/types";
import { DEFAULT_ATTENTION_BUDGET, DAILY_PRIORITY_THRESHOLDS } from "./constants";
import { generateCandidateActions } from "./candidateActions";
import { computeBreakdown } from "./features";
import { resolveRelationshipState } from "./relationshipState";
import { scoreActionForRelationship } from "./actionScoring";

function bestMoveForRelationship(
  relationship: DailyMoveSelectorInput["relationships"][number],
  generatedAt: string
): DailyMoveDecision | null {
  const baseline = computeBreakdown(relationship, "simple_followup", generatedAt);
  const state = resolveRelationshipState({
    hasUserActed: relationship.actionHistory.hasUserActed ?? false,
    hasRecipientReplied: relationship.actionHistory.hasRecipientReplied ?? false,
    relationshipWarmth: baseline.breakdown.relationshipWarmth,
    missionImpact: baseline.breakdown.missionImpact,
    evidenceConfidence: baseline.breakdown.evidenceConfidence,
    uncertaintyPenalty: baseline.breakdown.uncertaintyPenalty,
    lastOutcome: relationship.outcomeHistory.at(-1)?.outcomeType,
    userArchived: relationship.actionHistory.userArchived ?? false
  });
  if (relationship.evidenceBundle.entityResolution.score < 0.45 || baseline.breakdown.evidenceConfidence < 0.45) {
    return scoreActionForRelationship(relationship, "confirm_details", generatedAt);
  }
  if (state === "waiting") {
    return scoreActionForRelationship(relationship, "wait", generatedAt);
  }
  const candidates = generateCandidateActions({
    relationship,
    relationshipState: state,
    evidenceConfidence: baseline.breakdown.evidenceConfidence,
    nextStepClarity: baseline.breakdown.nextStepClarity
  });
  const moves = candidates
    .map((action, index) => ({ index, move: scoreActionForRelationship(relationship, action, generatedAt) }))
    .filter((item) => item.move.recommendedAction !== "archive" && item.move.recommendedAction !== "do_not_act")
    .sort((left, right) => {
      const delta = right.move.dailyPriority - left.move.dailyPriority;
      return Math.abs(delta) < 0.08 ? left.index - right.index : delta;
    })
    .map((item) => item.move);
  return moves[0] ?? null;
}

function diversify(moves: DailyMoveDecision[]): DailyMoveDecision[] {
  const result: DailyMoveDecision[] = [];
  let highAskCount = 0;
  for (const move of moves) {
    const highAsk = move.scoreBreakdown.askSize >= 0.6;
    if (highAsk && highAskCount >= 2) continue;
    if (result.some((existing) => existing.contactId === move.contactId)) continue;
    result.push(move);
    if (highAsk) highAskCount += 1;
  }
  return result;
}

export function selectDailyMoves(input: DailyMoveSelectorInput): DailyMoveDecision[] {
  const budget = input.attentionBudget ?? input.objective.attentionBudgetToday ?? DEFAULT_ATTENTION_BUDGET;
  const moves = input.relationships
    .map((relationship) => bestMoveForRelationship(relationship, input.generatedAt))
    .filter((move): move is DailyMoveDecision => Boolean(move))
    .filter((move) => {
      if (move.recommendedAction === "confirm_details") return move.scoreBreakdown.missionImpact >= 0.45;
      if (move.recommendedAction === "wait" || move.recommendedAction === "snooze") {
        return move.scoreBreakdown.pushinessRisk >= 0.55 || move.costOfSilence >= 0.3;
      }
      if (move.blockedFacts.length > 0 && move.scoreBreakdown.missionImpact >= 0.45) return true;
      return move.dailyPriority >= DAILY_PRIORITY_THRESHOLDS.showInBrief;
    })
    .sort((left, right) => right.dailyPriority - left.dailyPriority);

  return diversify(moves).slice(0, Math.max(0, budget));
}

export function toDailyMoveView(move: DailyMoveDecision): DailyMoveView {
  return {
    relationshipId: move.relationshipId,
    contactName: move.contactName,
    company: move.company,
    relationshipState: move.relationshipState,
    recommendedAction: move.recommendedAction,
    priorityLabel: move.dailyPriority >= 0.75 ? "high" : move.dailyPriority >= 0.55 ? "medium" : "low",
    suggestedTiming: move.suggestedTiming,
    whyNow: move.whyNow,
    whatToAvoid: move.whatToAvoid,
    risks: move.risks
  };
}
