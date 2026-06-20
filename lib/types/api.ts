import type {
  CaptureType,
  ContactStatus,
  Id,
  ISODateTime,
  ProcessStageEvent,
} from "./common";
import type { ContactCandidate } from "./contact";
import type { ConversationAtoms } from "./conversation";
import type {
  CalaEntityCandidate,
  PublicEntityContext,
  SourceRecord,
  WebContextClaim,
} from "./context";
import type { EvidenceBundle, ExtractionHandoff, RecommendationPackage } from "./handoffs";
import type { ActionRecommendation, Draft, OpportunityRoute } from "./recommendation";
import type { Outcome, OutcomeType, TractionSummary } from "./outcome";
import type { UserObjectiveProfile, UserObjectiveProfileInput } from "./user";

export interface TextCaptureRequest {
  userId: Id;
  rawText: string;
  eventContext?: string;
  capturedAt?: ISODateTime;
}

export interface VoiceCaptureRequest {
  userId: Id;
  audioFile: File;
  eventContext?: string;
  capturedAt?: ISODateTime;
}

export interface CardCaptureRequest {
  userId: Id;
  imageFile?: File;
  manualTextFallback?: string;
  eventContext?: string;
}

export interface CaptureAcceptedResponse {
  requestId: Id;
  conversationId: Id;
  status: "captured" | "processing";
  streamUrl?: string;
}

export interface VoiceCaptureAcceptedResponse extends CaptureAcceptedResponse {
  transcriptStatus: "pending" | "completed" | "fallback_required";
  transcript?: string;
}

export interface CardCaptureAcceptedResponse extends CaptureAcceptedResponse {
  cardStatus: "captured" | "manual_fallback";
}

export interface ActiveObjectiveRequest {
  userId: Id;
}

export interface ActiveObjectiveResponse {
  objective: UserObjectiveProfile | null;
}

export interface ObjectiveSaveRequest extends UserObjectiveProfileInput {
  id?: Id;
}

export interface ObjectiveSaveResponse {
  objective: UserObjectiveProfile;
}

export interface ProcessConversationRequestBody {
  requestId: Id;
  userId: Id;
  conversationId?: Id;
  captureType: CaptureType;
  rawText?: string;
  transcript?: string;
  cardText?: string;
  eventContext?: string;
}

export type ProcessConversationStreamEvent = ProcessStageEvent;

export interface CalaEnrichmentRequest {
  userId: Id;
  contactId?: Id;
  conversationId: Id;
  name?: string;
  company?: string;
  role?: string;
  query?: string;
}

export interface CalaEnrichmentResponse {
  available: boolean;
  candidates: CalaEntityCandidate[];
  selectedContext?: PublicEntityContext;
  entityMatchConfidence: number;
  sourceRecords: SourceRecord[];
  warnings: string[];
}

export interface WebFallbackRequest {
  userId: Id;
  contactId?: Id;
  conversationId: Id;
  name?: string;
  company?: string;
  role?: string;
  query: string;
  calaAttempted: true;
  calaMatchConfidence?: number;
  allowUncitedClaims?: boolean;
}

export interface WebFallbackResponse {
  available: boolean;
  summary: string;
  claims: WebContextClaim[];
  sourceRecords: SourceRecord[];
  warnings: string[];
}

export interface WorkflowObjectiveSeed {
  role?: UserObjectiveProfile["role"];
  primaryGoal?: UserObjectiveProfile["primaryGoal"];
  activeGoals?: UserObjectiveProfile["activeGoals"];
  secondaryGoals?: UserObjectiveProfile["secondaryGoals"];
  eventContext?: string;
  companyName?: string;
  productDescription?: string;
  targetCustomer?: string;
  attentionBudgetToday?: number;
  preferredTone?: UserObjectiveProfile["preferredTone"];
  constraints?: string[];
}

export interface WorkflowCaptureEnrichRequest {
  userId: Id;
  rawText: string;
  eventContext?: string;
  capturedAt?: ISODateTime;
  name?: string;
  company?: string;
  role?: string;
  query?: string;
  includeWebFallback?: boolean;
  allowUncitedClaims?: boolean;
  ensureObjective?: boolean;
  objectiveSeed?: WorkflowObjectiveSeed;
}

export interface WorkflowCaptureEnrichResponse {
  objective: {
    existed: boolean;
    created: boolean;
    objectiveId: Id;
  };
  capture: CaptureAcceptedResponse;
  cala: CalaEnrichmentResponse;
  webFallback?: WebFallbackResponse;
}

export interface WorkflowCaptureWebFallbackRequest {
  userId: Id;
  rawText: string;
  eventContext?: string;
  capturedAt?: ISODateTime;
  name?: string;
  company?: string;
  role?: string;
  query?: string;
  allowUncitedClaims?: boolean;
  ensureObjective?: boolean;
  objectiveSeed?: WorkflowObjectiveSeed;
}

export interface WorkflowCaptureWebFallbackResponse {
  objective: {
    existed: boolean;
    created: boolean;
    objectiveId: Id;
  };
  capture: CaptureAcceptedResponse;
  webFallback: WebFallbackResponse;
}

export interface WorkflowFullFlowRequest extends Omit<WorkflowCaptureEnrichRequest, "rawText"> {
  rawText?: string;
  conversationId?: Id;
  requestId?: Id;
  captureType?: CaptureType;
  status?: ContactStatus;
  hoursSinceLastAction?: number;
}

export interface WorkflowFullFlowResponse {
  objective: {
    existed: boolean;
    created: boolean;
    objectiveId: Id;
  };
  capture: CaptureAcceptedResponse;
  extractionHandoff: ExtractionHandoff;
  evidenceBundle: EvidenceBundle;
  recommendationPackage: RecommendationPackage;
  events: ProcessStageEvent[];
}

export interface RecommendRequest {
  userId: Id;
  conversationId: Id;
  contactId?: Id;
  evidenceBundle?: EvidenceBundle;
}

export type RecommendResponse = RecommendationPackage;

export interface DraftGenerateRequest {
  userId: Id;
  recommendationId: Id;
  tone?: "direct" | "warm" | "formal" | "casual" | "concise";
}

export interface DraftGenerateResponse {
  draft: Draft;
  factsUsed: string[];
  riskNote?: string | null;
}

export interface OutcomeCreateRequest {
  userId: Id;
  contactId: Id;
  recommendationId?: Id;
  outcomeType: OutcomeType;
  notes?: string;
  value?: number;
}

export interface OutcomeCreateResponse {
  outcome: Outcome;
  updatedRecommendation?: ActionRecommendation;
  updatedTraction: TractionSummary;
}

export interface ExtractionPreview {
  contactCandidate: ContactCandidate;
  atoms: ConversationAtoms;
}

export interface RecommendationPreview {
  routes: OpportunityRoute[];
  recommendation: ActionRecommendation;
}
