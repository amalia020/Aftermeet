import type {
  ContactStatus,
  Id,
  ISODateTime,
  NumericScore,
  OpportunityType,
  RecommendedActionType,
} from "./common";

export interface UserClusterScores {
  fundraising: NumericScore;
  hiring: NumericScore;
  userDiscovery: NumericScore;
  partnerships: NumericScore;
  mentorship: NumericScore;
  recruiting: NumericScore;
  jobSeeking: NumericScore;
  sponsorBd: NumericScore;
}

export interface ContactClusterScores {
  investor: NumericScore;
  potentialUser: NumericScore;
  potentialHire: NumericScore;
  mentor: NumericScore;
  partner: NumericScore;
  recruiter: NumericScore;
  sponsor: NumericScore;
  founderPeer: NumericScore;
  lowPriority: NumericScore;
}

export interface OpportunityRoute {
  id?: Id;
  contactId?: Id;
  conversationId?: Id;
  type: OpportunityType;
  score: NumericScore;
  evidence: string[];
  why: string[];
  whyNot: string[];
  createdAt?: ISODateTime;
}

export interface DecisionTrace {
  inputSummary: string;
  extractedFacts: string[];
  retrievedContext: string[];
  routeScores: OpportunityRoute[];
  chosenRoute: OpportunityRoute;
  chosenAction: RecommendedActionType;
  whyThisAction: string[];
  whyNotOtherActions: string[];
  confidenceBreakdown: {
    entityMatch: NumericScore;
    sourceConfidence: NumericScore;
    factConfidence: NumericScore;
    userGoalFit: NumericScore;
    contactPovFit: NumericScore;
    recipientBurden: NumericScore;
    finalConfidence: NumericScore;
  };
  safeFactsUsed: string[];
  warnings: string[];
}

export type ActionRecommendationStatus =
  | "pending"
  | "accepted"
  | "sent"
  | "snoozed"
  | "archived"
  | "overridden";

export interface ActionRecommendation {
  id: Id;
  userId: Id;
  contactId: Id;
  conversationId: Id;
  recommendedAction: RecommendedActionType;
  priorityScore: NumericScore;
  urgencyScore: NumericScore;
  recipientBurden: NumericScore;
  confidence: NumericScore;
  status: ActionRecommendationStatus;
  explanation: DecisionTrace;
  createdAt: ISODateTime;
}

export interface Draft {
  id: Id;
  recommendationId: Id;
  contactId: Id;
  channel: "email" | "linkedin" | "sms" | "manual";
  tone?: string | null;
  subject?: string | null;
  body: string;
  factsUsed: string[];
  status: "drafted" | "edited" | "sent" | "discarded";
  riskNote?: string | null;
  createdAt: ISODateTime;
  sentAt?: ISODateTime | null;
}

export interface FollowUpBoardCard {
  contactId: Id;
  recommendationId?: Id;
  contactName?: string | null;
  company?: string | null;
  status: ContactStatus;
  recommendedAction: RecommendedActionType;
  priorityScore: NumericScore;
  urgencyScore: NumericScore;
  warmthScore: NumericScore;
  warning: boolean;
  warningReason?: string;
  updatedAt: ISODateTime;
}

export interface ContactClusterSummary {
  clusterName: string;
  count: number;
  averagePriority: NumericScore;
}

export interface ClusterRecommendation {
  clusterName: string;
  score: NumericScore;
  why: string[];
  suggestedAction: string;
  expectedSignal: string;
  confidence: NumericScore;
}
