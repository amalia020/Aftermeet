import type {
  ActionRecommendation,
  Contact,
  ConversationAtoms,
  DailyMoveDecision,
  EvidenceBundle,
  Id,
  OpportunityRoute,
  RelationshipMoveInput,
  UserObjectiveProfile
} from "@/lib/types";
import {
  getActiveObjective,
  getAtomsForConversation,
  getContact,
  getConversation,
  getEvidenceBundleForConversation,
  listOutcomes,
  listRecommendations
} from "@/lib/db/queries";
import { demoObjective } from "@/lib/demo/fixtures";
import { computeBreakdown } from "./features";
import { resolveRelationshipState } from "./relationshipState";
import { generateCandidateActions } from "./candidateActions";
import { scoreActionForRelationship } from "./actionScoring";
import { selectDailyMoves } from "./dailyMoveSelector";

function emptyAtoms(rec: ActionRecommendation): ConversationAtoms {
  return {
    facts: rec.explanation.extractedFacts.map((fact) => ({
      text: fact,
      confidence: rec.confidence,
      isProfessional: true,
      isSensitive: false
    })),
    asks: [],
    offers: [],
    commitments: [],
    uncertainties: rec.explanation.warnings,
    sentiment: null,
    extractionConfidence: rec.confidence
  };
}

function fallbackRoute(rec: ActionRecommendation): OpportunityRoute {
  return rec.explanation.chosenRoute ?? {
    id: `route_${rec.id}`,
    contactId: rec.contactId,
    conversationId: rec.conversationId,
    type: "other",
    score: rec.priorityScore,
    evidence: rec.explanation.extractedFacts,
    why: rec.explanation.whyThisAction,
    whyNot: rec.explanation.whyNotOtherActions,
    createdAt: rec.createdAt
  };
}

function fallbackBundle(input: {
  rec: ActionRecommendation;
  contact: Contact | null;
  objective: UserObjectiveProfile;
}): EvidenceBundle {
  return {
    requestId: `req_${input.rec.id}`,
    userId: input.rec.userId,
    conversationId: input.rec.conversationId,
    contactId: input.rec.contactId,
    contactCandidate: {
      name: input.contact?.name ?? null,
      role: input.contact?.role ?? null,
      company: input.contact?.company ?? null,
      email: input.contact?.email ?? null,
      phone: input.contact?.phone ?? null,
      website: input.contact?.website ?? null,
      linkedinUrl: input.contact?.linkedinUrl ?? null
    },
    publicContext: [],
    sourceRecords: [],
    evidenceFacts: input.rec.explanation.safeFactsUsed.map((fact, index) => ({
      id: `fact_${input.rec.id}_${index}`,
      contactId: input.rec.contactId,
      conversationId: input.rec.conversationId,
      fact,
      factType: "recommendation_trace",
      sourceRecordId: null,
      sourceType: "manual",
      entityMatchConfidence: input.contact?.entityMatchConfidence ?? input.rec.confidence,
      sourceConfidence: input.rec.explanation.confidenceBreakdown.sourceConfidence,
      extractionConfidence: input.rec.confidence,
      freshness: 0.6,
      contradictionPenalty: 0,
      factConfidence: input.rec.explanation.confidenceBreakdown.factConfidence,
      safeForDraft: true,
      isProfessional: true,
      isSensitive: false,
      createdAt: input.rec.createdAt
    })),
    entityResolution: {
      capturedName: input.contact?.name ?? undefined,
      capturedCompany: input.contact?.company ?? undefined,
      capturedRole: input.contact?.role ?? undefined,
      score: input.contact?.entityMatchConfidence ?? input.rec.confidence,
      label: input.rec.confidence >= 0.75 ? "high" : input.rec.confidence >= 0.45 ? "medium" : "low",
      needsUserConfirmation: input.rec.recommendedAction === "CONFIRM_DETAILS",
      reasons: ["Fallback bundle reconstructed from the Part 3 recommendation."]
    },
    enrichment: {
      attempted: false,
      calaAttempted: false,
      webFallbackAttempted: false,
      status: "skipped",
      warnings: input.rec.explanation.warnings
    }
  };
}

function moveInputForRecommendation(
  rec: ActionRecommendation,
  objective: UserObjectiveProfile
): RelationshipMoveInput {
  const contact = getContact(rec.contactId);
  const conversation = getConversation(rec.conversationId);
  const atoms = getAtomsForConversation(rec.conversationId) ?? emptyAtoms(rec);
  const evidenceBundle =
    getEvidenceBundleForConversation(rec.conversationId) ??
    fallbackBundle({ rec, contact, objective });
  const outcomes = listOutcomes(rec.userId).filter(
    (outcome) => outcome.contactId === rec.contactId || outcome.recommendationId === rec.id,
  );

  return {
    relationshipId: rec.id,
    contactId: rec.contactId,
    userId: rec.userId,
    contactName: contact?.name ?? evidenceBundle.contactCandidate.name ?? null,
    company: contact?.company ?? evidenceBundle.contactCandidate.company ?? null,
    objective,
    conversationAtoms: atoms,
    evidenceBundle,
    topOpportunityRoute: fallbackRoute(rec),
    part3Recommendation: rec,
    actionHistory: {
      hasUserActed: rec.status === "sent" || outcomes.some((outcome) => outcome.outcomeType === "sent"),
      hasRecipientReplied: outcomes.some((outcome) => ["reply", "booked", "paid", "wtp"].includes(outcome.outcomeType)),
      lastNudgeAt: outcomes.find((outcome) => outcome.outcomeType === "sent")?.createdAt ?? null,
      lastNudgeNoResponse: outcomes.some((outcome) => outcome.outcomeType === "sent") &&
        !outcomes.some((outcome) => ["reply", "booked", "paid", "wtp"].includes(outcome.outcomeType)),
      userArchived: rec.status === "archived",
      contactStatus: conversation?.processingStatus === "failed" ? "archived" : undefined
    },
    outcomeHistory: outcomes.map((outcome) => ({
      opportunityType: rec.explanation.chosenRoute.type,
      outcomeType: outcome.outcomeType,
      createdAt: outcome.createdAt,
      value: outcome.value
    })),
    capturedAt: conversation?.capturedAt ?? rec.createdAt,
    lastInteractionAt: outcomes[0]?.createdAt ?? conversation?.capturedAt ?? rec.createdAt
  };
}

export function buildRelationshipMoveInputs(input: {
  userId: Id;
  generatedAt?: string;
  objective?: UserObjectiveProfile;
}): RelationshipMoveInput[] {
  const objective = input.objective ?? getActiveObjective(input.userId) ?? demoObjective;
  void input.generatedAt;
  return listRecommendations(input.userId)
    .filter((rec) => rec.status !== "archived" && rec.status !== "overridden")
    .map((rec) => moveInputForRecommendation(rec, objective));
}

export function scoreStoredRelationshipMoves(input: {
  userId: Id;
  generatedAt: string;
  objective?: UserObjectiveProfile;
}): DailyMoveDecision[] {
  return buildRelationshipMoveInputs(input)
    .map((relationship) => {
      const baseline = computeBreakdown(relationship, "simple_followup", input.generatedAt);
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
        return scoreActionForRelationship(relationship, "confirm_details", input.generatedAt);
      }
      if (state === "waiting") {
        return scoreActionForRelationship(relationship, "wait", input.generatedAt);
      }
      const actions = generateCandidateActions({
        relationship,
        relationshipState: state,
        evidenceConfidence: baseline.breakdown.evidenceConfidence,
        nextStepClarity: baseline.breakdown.nextStepClarity
      });
      return actions
        .map((action, index) => ({ index, move: scoreActionForRelationship(relationship, action, input.generatedAt) }))
        .sort((left, right) => {
          const delta = right.move.dailyPriority - left.move.dailyPriority;
          return Math.abs(delta) < 0.08 ? left.index - right.index : delta;
        })[0]?.move;
    })
    .filter((move): move is DailyMoveDecision => Boolean(move))
    .sort((left, right) => right.dailyPriority - left.dailyPriority);
}

export function selectStoredDailyMoves(input: {
  userId: Id;
  generatedAt: string;
  objective?: UserObjectiveProfile;
}): DailyMoveDecision[] {
  const objective = input.objective ?? getActiveObjective(input.userId) ?? demoObjective;
  return selectDailyMoves({
    userId: input.userId,
    objective,
    relationships: buildRelationshipMoveInputs({ ...input, objective }),
    generatedAt: input.generatedAt
  });
}
