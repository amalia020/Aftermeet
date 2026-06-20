import type {
  EvidenceFact,
  RelationshipDeltaBreakdown,
  RelationshipMoveAction,
  RelationshipMoveInput,
  ScoreFeature
} from "@/lib/types";
import { clamp01, roundScore, tokenSimilarity } from "@/lib/intelligence/utils";
import { ASK_SIZE_BY_ACTION, USER_EFFORT_BY_ACTION } from "./constants";
import { daysBetween, scoreFeature } from "./normalizers";

function avg(values: number[], fallback: number): number {
  const present = values.filter((value) => Number.isFinite(value));
  if (!present.length) return fallback;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function goalRouteScore(input: RelationshipMoveInput): number {
  const goal = input.objective.primaryGoal;
  const route = input.topOpportunityRoute.type;
  const direct: Record<string, string[]> = {
    find_users: ["user", "customer"],
    find_design_partners: ["partner", "customer", "user"],
    collect_wtp: ["customer", "user"],
    raise: ["raise"],
    hire: ["hire", "candidate"],
    source_candidates: ["candidate", "hire"],
    find_customers: ["customer", "user"],
    find_partners: ["partner"],
    find_mentors: ["mentor"],
    find_job_opportunities: ["job"],
    build_community: ["community"]
  };
  if (direct[goal]?.includes(route)) return 1;
  return input.objective.secondaryGoals.some((secondary) => direct[secondary]?.includes(route)) ? 0.7 : 0.2;
}

function textBlob(input: RelationshipMoveInput): string {
  return [
    input.contactName,
    input.company,
    input.topOpportunityRoute.evidence.join(" "),
    ...input.conversationAtoms.facts.map((fact) => fact.text),
    ...input.conversationAtoms.asks.map((ask) => ask.text),
    ...input.conversationAtoms.offers.map((offer) => offer.text),
    ...input.conversationAtoms.commitments.map((commitment) => commitment.text)
  ]
    .filter(Boolean)
    .join(" ");
}

function conversationDepth(input: RelationshipMoveInput): number {
  const atoms = input.conversationAtoms;
  const count = atoms.facts.length + atoms.asks.length + atoms.offers.length + atoms.commitments.length;
  if (atoms.asks.length && atoms.commitments.length) return 0.9;
  if (count >= 5) return 0.75;
  if (count >= 2) return 0.55;
  if (count === 1) return 0.35;
  return 0.1;
}

function statedInterest(input: RelationshipMoveInput): number {
  const text = textBlob(input);
  if (/\b(wants?|asked|interested|try|pilot|follow up|send|liked|needs?|hiring|raising)\b/i.test(text)) {
    return 0.85;
  }
  if (/\b(friendly|good chat|warm)\b/i.test(text)) return 0.45;
  return 0.15;
}

function permissionStrength(input: RelationshipMoveInput): number {
  const commitment = avg(input.conversationAtoms.commitments.map((item) => item.explicitness ?? 0.7), 0);
  const ask = avg(input.conversationAtoms.asks.map((item) => item.explicitness ?? 0.65), 0);
  if (commitment || ask) return Math.max(commitment, ask);
  if (conversationDepth(input) >= 0.75) return 0.35;
  return 0.1;
}

function nextStepClarity(input: RelationshipMoveInput): number {
  const explicitPromise = avg(input.conversationAtoms.commitments.map((item) => item.explicitness ?? 0.7), 0);
  const contactRequest = avg(input.conversationAtoms.asks.map((item) => item.explicitness ?? 0.6), 0);
  const specificSharedTopic = conversationDepth(input);
  const recommendedSpecificity = input.part3Recommendation ? input.part3Recommendation.confidence : input.topOpportunityRoute.score;
  return roundScore(0.35 * explicitPromise + 0.25 * contactRequest + 0.2 * specificSharedTopic + 0.2 * recommendedSpecificity);
}

function reciprocityFit(input: RelationshipMoveInput, action: RelationshipMoveAction): number {
  const offeredValue = avg(input.conversationAtoms.offers.map((offer) => offer.mutualValue ?? 0.65), 0.25);
  const askSize = ASK_SIZE_BY_ACTION[action];
  return roundScore(clamp01(offeredValue / Math.max(askSize, 0.1)));
}

function evidenceConfidence(input: RelationshipMoveInput): number {
  const facts = input.evidenceBundle.evidenceFacts;
  const factConfidence = avg(facts.map((fact) => fact.factConfidence), facts.length ? 0.5 : 0.35);
  const sourceConfidence = avg(facts.map((fact) => fact.sourceConfidence), facts.length ? 0.5 : 0.35);
  const freshnessConfidence = avg(facts.map((fact) => fact.freshness), 0.5);
  const contradictionPenalty = Math.max(0, ...facts.map((fact) => fact.contradictionPenalty));
  return roundScore(clamp01(
    0.25 * input.conversationAtoms.extractionConfidence +
      0.2 * input.evidenceBundle.entityResolution.score +
      0.2 * factConfidence +
      0.15 * sourceConfidence +
      0.1 * freshnessConfidence +
      0.1 * 0.2 -
      contradictionPenalty
  ));
}

function recentNudgePenalty(input: RelationshipMoveInput, generatedAt: string): number {
  const days = daysBetween(input.actionHistory.lastNudgeAt, generatedAt);
  if (!input.actionHistory.lastNudgeAt) return 0;
  const base = days <= 1 ? 0.45 : days <= 3 ? 0.3 : days <= 7 ? 0.15 : 0;
  return clamp01(base + (input.actionHistory.lastNudgeNoResponse ? 0.15 : 0));
}

export function splitDraftFacts(input: RelationshipMoveInput): {
  safeFactsForDraft: string[];
  blockedFacts: string[];
  creepinessRisk: number;
} {
  const safeFactsForDraft: string[] = [];
  const blockedFacts: string[] = [];
  let highestRisk = 0.1;

  for (const fact of input.evidenceBundle.evidenceFacts) {
    const anchoring = conversationAnchoring(input, fact);
    const sensitivity = fact.isSensitive ? 1 : fact.isProfessional ? 0.2 : 0.7;
    const publicOnlySpecificity = fact.sourceType === "user_voice_note" || fact.sourceType === "manual" ? 0.1 : 0.8;
    const risk = clamp01(publicOnlySpecificity * sensitivity * (1 - anchoring));
    highestRisk = Math.max(highestRisk, risk);
    const safe =
      fact.factConfidence >= 0.75 &&
      fact.isProfessional &&
      !fact.isSensitive &&
      fact.sourceType !== "unknown" &&
      risk <= 0.6 &&
      anchoring >= 0.4;
    if (safe) safeFactsForDraft.push(fact.fact);
    else blockedFacts.push(fact.fact);
  }

  return { safeFactsForDraft, blockedFacts, creepinessRisk: roundScore(Math.min(highestRisk, 0.4)) };
}

function conversationAnchoring(input: RelationshipMoveInput, fact: EvidenceFact): number {
  if (fact.sourceType === "user_voice_note" || fact.sourceType === "manual") return 1;
  const similarity = tokenSimilarity(fact.fact, textBlob(input));
  if (similarity >= 0.35) return 0.7;
  if (input.company && fact.fact.toLowerCase().includes(input.company.toLowerCase())) return 0.4;
  return 0;
}

export function computeBreakdown(
  input: RelationshipMoveInput,
  action: RelationshipMoveAction,
  generatedAt: string
): { breakdown: RelationshipDeltaBreakdown; featureTrace: ScoreFeature[]; safeFactsForDraft: string[]; blockedFacts: string[] } {
  const depth = conversationDepth(input);
  const routeFit = goalRouteScore(input);
  const explicitConversationFit = tokenSimilarity(textBlob(input), [
    input.objective.productDescription,
    input.objective.targetCustomer,
    input.objective.eventContext,
    input.objective.hiringNeeds?.join(" ")
  ].filter(Boolean).join(" "));
  const missionImpact = roundScore(clamp01(0.5 * input.topOpportunityRoute.score + 0.3 * routeFit + 0.2 * explicitConversationFit));
  const relationshipFit = roundScore(clamp01(
    0.35 * statedInterest(input) + 0.25 * routeFit + 0.2 * depth + 0.2 * avg(input.conversationAtoms.offers.map((offer) => offer.mutualValue ?? 0.65), 0.25)
  ));
  const strategicScarcity = roundScore(clamp01(1 - (input.missionGapCoverage ?? 0.25)));
  const daysSinceLast = daysBetween(input.lastInteractionAt ?? input.capturedAt, generatedAt);
  const baseWarmth = roundScore(0.3 * depth + 0.3 * permissionStrength(input) + 0.2 * statedInterest(input) + 0.2 * Math.min(1, input.conversationAtoms.facts.length / 4));
  const halfLifeDays = depth >= 0.75 ? 7 : depth >= 0.45 ? 4 : 2;
  const relationshipWarmth = roundScore(baseWarmth * Math.exp(-daysSinceLast / halfLifeDays));
  const clarity = nextStepClarity(input);
  const reciprocity = reciprocityFit(input, action);
  const permission = permissionStrength(input);
  const actionReadiness = roundScore(clamp01(0.35 * relationshipWarmth + 0.3 * clarity + 0.25 * reciprocity + 0.1 * permission));
  const freshnessBoost = roundScore(Math.exp(-daysBetween(input.capturedAt, generatedAt) / 5));
  const decayRisk = roundScore(clamp01(0.45 * (1 - freshnessBoost) + 0.25 * statedInterest(input) + 0.2 * depth + 0.1 * strategicScarcity));
  const externalUrgency = /\b(deadline|this week|next event|conference|quarter|hiring|scaling)\b/i.test(textBlob(input)) ? 0.6 : 0;
  const timingWindow = roundScore(clamp01(0.4 * freshnessBoost + 0.35 * decayRisk + 0.25 * externalUrgency));
  const evidence = evidenceConfidence(input);
  const askSize = ASK_SIZE_BY_ACTION[action];
  const userEffort = USER_EFFORT_BY_ACTION[action];
  const weakContextPenalty = 1 - relationshipWarmth;
  const lowMutualValuePenalty = 1 - reciprocity;
  const recipientBurden = roundScore(clamp01(0.3 * (1 - clarity) + 0.25 * askSize + 0.2 * weakContextPenalty + 0.15 * lowMutualValuePenalty + 0.1 * (1 - timingWindow)));
  const actionCost = roundScore(clamp01(0.45 * recipientBurden + 0.3 * userEffort + 0.25 * askSize));
  const noPermissionPenalty = permission >= 0.7 ? 0 : permission >= 0.35 ? 0.2 : 0.35;
  const pushinessRisk = roundScore(clamp01(askSize * (1 - relationshipWarmth) + recentNudgePenalty(input, generatedAt) + noPermissionPenalty));
  const uncertaintyPenalty = roundScore(clamp01(
    0.35 * (1 - input.evidenceBundle.entityResolution.score) +
      0.25 * (1 - evidence) +
      0.2 * (input.objective.primaryGoal === "other" ? 0.7 : 0.1) +
      0.2 * (1 - clarity)
  ));
  const facts = splitDraftFacts(input);
  const riskPenalty = roundScore(clamp01(0.4 * pushinessRisk + 0.3 * uncertaintyPenalty + 0.3 * facts.creepinessRisk));
  const opportunityUpside = roundScore(clamp01(0.45 * missionImpact + 0.3 * relationshipFit + 0.25 * strategicScarcity));
  const relationshipDelta = roundScore(clamp01(opportunityUpside * actionReadiness * timingWindow * evidence - actionCost - riskPenalty));
  const costOfSilence = roundScore(clamp01(missionImpact * decayRisk * strategicScarcity * relationshipWarmth));
  const dailyPriority = roundScore(clamp01(0.45 * costOfSilence + 0.35 * relationshipDelta + 0.2 * actionReadiness - 0.25 * pushinessRisk - 0.2 * facts.creepinessRisk - 0.2 * uncertaintyPenalty));

  const breakdown = {
    opportunityUpside,
    missionImpact,
    relationshipFit,
    strategicScarcity,
    actionReadiness,
    relationshipWarmth,
    nextStepClarity: clarity,
    reciprocityFit: reciprocity,
    permissionStrength: roundScore(permission),
    timingWindow,
    freshnessBoost,
    decayRisk,
    externalUrgency,
    evidenceConfidence: evidence,
    actionCost,
    recipientBurden,
    userEffort,
    askSize,
    riskPenalty,
    pushinessRisk,
    uncertaintyPenalty,
    creepinessRisk: facts.creepinessRisk,
    relationshipDelta,
    costOfSilence,
    dailyPriority
  };

  return {
    breakdown,
    safeFactsForDraft: facts.safeFactsForDraft,
    blockedFacts: facts.blockedFacts,
    featureTrace: [
      scoreFeature({ key: "missionImpact", source: "objective", rawValue: input.topOpportunityRoute.type, normalizedValue: missionImpact, confidence: evidence, reason: "Route fit and conversation context against active objective." }),
      scoreFeature({ key: "relationshipWarmth", source: "conversation", rawValue: daysSinceLast, normalizedValue: relationshipWarmth, confidence: input.conversationAtoms.extractionConfidence, reason: "Conversation depth, permission, sentiment, and time decay." }),
      scoreFeature({ key: "evidenceConfidence", source: "evidence", rawValue: input.evidenceBundle.entityResolution.score, normalizedValue: evidence, confidence: evidence, reason: "Extraction, entity match, fact/source confidence, freshness, and contradictions." }),
      scoreFeature({ key: "pushinessRisk", source: "history", rawValue: input.actionHistory.lastNudgeAt ?? null, normalizedValue: pushinessRisk, confidence: 0.8, reason: "Ask size, warmth, permission, and recent nudge history." })
    ]
  };
}
