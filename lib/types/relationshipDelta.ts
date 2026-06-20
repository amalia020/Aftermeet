import type { ConversationAtoms } from "./conversation";
import type { ContactStatus, Id, ISODateTime, JsonPrimitive, NumericScore } from "./common";
import type { EvidenceBundle } from "./handoffs";
import type { ActionRecommendation, OpportunityRoute } from "./recommendation";
import type { OutcomeSummary } from "./outcome";
import type { UserObjectiveProfile } from "./user";

export type ScoreFeatureSource =
  | "conversation"
  | "evidence"
  | "objective"
  | "history"
  | "default"
  | "feedback";

export interface ScoreFeature {
  key: string;
  source: ScoreFeatureSource;
  rawValue: JsonPrimitive;
  normalizedValue: NumericScore;
  confidence: NumericScore;
  reason: string;
}

export type RelationshipState =
  | "new"
  | "warm"
  | "waiting"
  | "cooling"
  | "dormant"
  | "blocked"
  | "converted"
  | "archived";

export type RelationshipMoveAction =
  | "share_resource"
  | "simple_followup"
  | "ask_quick_opinion"
  | "ask_for_feedback"
  | "ask_for_intro"
  | "ask_for_meeting"
  | "ask_for_pilot"
  | "ask_for_investment"
  | "ask_for_job_or_hiring_loop"
  | "make_intro"
  | "confirm_details"
  | "add_context"
  | "wait"
  | "snooze"
  | "re_engage"
  | "archive"
  | "do_not_act";

export interface RelationshipActionHistory {
  hasUserActed?: boolean;
  hasRecipientReplied?: boolean;
  lastNudgeAt?: ISODateTime | null;
  lastNudgeNoResponse?: boolean;
  userArchived?: boolean;
  contactStatus?: ContactStatus;
}

export interface RelationshipMoveInput {
  relationshipId: Id;
  contactId: Id;
  userId: Id;
  contactName?: string | null;
  company?: string | null;
  objective: UserObjectiveProfile;
  conversationAtoms: ConversationAtoms;
  evidenceBundle: EvidenceBundle;
  topOpportunityRoute: OpportunityRoute;
  part3Recommendation?: ActionRecommendation;
  actionHistory: RelationshipActionHistory;
  outcomeHistory: OutcomeSummary[];
  capturedAt: ISODateTime;
  lastInteractionAt?: ISODateTime | null;
  missionGapCoverage?: NumericScore;
}

export interface RelationshipDeltaBreakdown {
  opportunityUpside: NumericScore;
  missionImpact: NumericScore;
  relationshipFit: NumericScore;
  strategicScarcity: NumericScore;
  actionReadiness: NumericScore;
  relationshipWarmth: NumericScore;
  nextStepClarity: NumericScore;
  reciprocityFit: NumericScore;
  permissionStrength: NumericScore;
  timingWindow: NumericScore;
  freshnessBoost: NumericScore;
  decayRisk: NumericScore;
  externalUrgency: NumericScore;
  evidenceConfidence: NumericScore;
  actionCost: NumericScore;
  recipientBurden: NumericScore;
  userEffort: NumericScore;
  askSize: NumericScore;
  riskPenalty: NumericScore;
  pushinessRisk: NumericScore;
  uncertaintyPenalty: NumericScore;
  creepinessRisk: NumericScore;
  relationshipDelta: NumericScore;
  costOfSilence: NumericScore;
  dailyPriority: NumericScore;
}

export interface DailyMoveDecision {
  relationshipId: Id;
  contactId: Id;
  contactName?: string | null;
  company?: string | null;
  relationshipState: RelationshipState;
  recommendedAction: RelationshipMoveAction;
  dailyPriority: NumericScore;
  relationshipDelta: NumericScore;
  costOfSilence: NumericScore;
  confidence: NumericScore;
  urgency: "high" | "medium" | "low";
  suggestedTiming: "today" | "this_week" | "wait" | "later";
  whyNow: string[];
  whyThisAction: string[];
  whyNot: string[];
  whatToAvoid: string[];
  risks: string[];
  safeFactsForDraft: string[];
  blockedFacts: string[];
  scoreBreakdown: RelationshipDeltaBreakdown;
  featureTrace: ScoreFeature[];
}

export interface DailyMoveView {
  relationshipId: Id;
  contactName?: string | null;
  company?: string | null;
  relationshipState: RelationshipState;
  recommendedAction: RelationshipMoveAction;
  priorityLabel: "high" | "medium" | "low";
  suggestedTiming: "today" | "this_week" | "wait" | "later";
  whyNow: string[];
  whatToAvoid: string[];
  risks: string[];
}

export interface DailyMoveSelectorInput {
  userId: Id;
  objective: UserObjectiveProfile;
  relationships: RelationshipMoveInput[];
  attentionBudget?: number;
  generatedAt: ISODateTime;
}
