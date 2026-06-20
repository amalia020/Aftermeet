import type { CaptureType, Id, ISODateTime, ProcessStageEvent } from "./common";
import type { ContactCandidate } from "./contact";
import type { ConversationAtoms } from "./conversation";
import type {
  CalaEntityCandidate,
  PublicEntityContext,
  SourceRecord,
  WebContextClaim,
} from "./context";
import type { EvidenceBundle, RecommendationPackage } from "./handoffs";
import type { ActionRecommendation, Draft, OpportunityRoute } from "./recommendation";
import type { Outcome, OutcomeType, TractionSummary } from "./outcome";

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
}

export interface CardCaptureAcceptedResponse extends CaptureAcceptedResponse {
  cardStatus: "captured" | "manual_fallback";
}

export interface ProcessConversationStreamEvent extends ProcessStageEvent {}

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
}

export interface WebFallbackResponse {
  available: boolean;
  summary: string;
  claims: WebContextClaim[];
  sourceRecords: SourceRecord[];
  warnings: string[];
}

export interface RecommendRequest {
  userId: Id;
  conversationId: Id;
  contactId?: Id;
  evidenceBundle?: EvidenceBundle;
}

export interface RecommendResponse extends RecommendationPackage {}

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
