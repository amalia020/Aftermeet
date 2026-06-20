import type { Id, ISODateTime, ProcessStageEvent } from "./common";
import type { EvidenceBundle, ExtractionHandoff, RecommendationPackage } from "./handoffs";
import type { OutcomeCreateResponse, RecommendResponse } from "./api";
import type { ContactSummary } from "./contact";
import type { TractionSummary } from "./outcome";
import type {
  ClusterRecommendation,
  FollowUpBoardCard,
  OpportunityRoute,
} from "./recommendation";
import type { UserObjectiveProfile } from "./user";

export type FrontendRoute =
  | "/"
  | "/capture"
  | "/contacts"
  | "/contacts/[id]"
  | "/board"
  | "/terminal"
  | "/traction";

export type ScreenState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "fallback"
  | "blocked"
  | "error";

export type PipelineStageVisualStatus =
  | "idle"
  | "active"
  | "complete"
  | "fallback"
  | "blocked"
  | "error";

export interface NavigationItem {
  route: FrontendRoute;
  label: string;
  badgeCount?: number;
  isPrimary?: boolean;
}

export interface PipelineStageView {
  id: ProcessStageEvent["stage"];
  label: string;
  status: PipelineStageVisualStatus;
  description?: string;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  warning?: string;
}

export interface ProcessingCascadeViewModel {
  requestId: Id;
  conversationId?: Id;
  stages: PipelineStageView[];
  latestEvent?: ProcessStageEvent;
  state: ScreenState;
}

export interface DecisionTraceViewModel {
  package: RecommendationPackage;
  cascade: {
    conversation: string;
    facts: string[];
    context: string[];
    routes: OpportunityRoute[];
    decision: string;
    draft?: string;
  };
  state: ScreenState;
}

export interface MissionSetupViewModel {
  activeObjective?: UserObjectiveProfile;
  state: ScreenState;
}

export interface CaptureScreenViewModel {
  activeObjective?: UserObjectiveProfile;
  acceptableUseText: string;
  supportedCaptureTypes: ("text" | "voice" | "card")[];
  state: ScreenState;
}

export interface ContactListViewModel {
  contacts: ContactSummary[];
  state: ScreenState;
}

export interface PersonViewModel {
  contactId: Id;
  recommendationPackage?: RecommendationPackage;
  evidenceBundle?: EvidenceBundle;
  state: ScreenState;
}

export interface FollowUpBoardViewModel {
  columns: {
    status: FollowUpBoardCard["status"];
    cards: FollowUpBoardCard[];
  }[];
  state: ScreenState;
}

export interface OpportunityTerminalViewModel {
  activeObjective?: UserObjectiveProfile;
  opportunityMix: {
    route: OpportunityRoute["type"];
    count: number;
    averageScore: number;
  }[];
  coverageGaps: string[];
  recommendedClusters: ClusterRecommendation[];
  actionQueue: FollowUpBoardCard[];
  attentionBudgetRemaining: number;
  state: ScreenState;
}

export interface TractionViewModel {
  summary: TractionSummary;
  state: ScreenState;
}

export interface FrontendMockDataset {
  objective: UserObjectiveProfile;
  extractionHandoff: ExtractionHandoff;
  evidenceBundle: EvidenceBundle;
  recommendationPackage: RecommendationPackage;
  processingEvents: ProcessStageEvent[];
  recommendResponse?: RecommendResponse;
  outcomeResponse?: OutcomeCreateResponse;
}

export interface FrontendRouteContract {
  route: FrontendRoute;
  primaryViewModel:
    | "MissionSetupViewModel"
    | "CaptureScreenViewModel"
    | "ProcessingCascadeViewModel"
    | "DecisionTraceViewModel"
    | "ContactListViewModel"
    | "PersonViewModel"
    | "FollowUpBoardViewModel"
    | "OpportunityTerminalViewModel"
    | "TractionViewModel";
  requiredContracts: string[];
  canUseMockData: boolean;
}
