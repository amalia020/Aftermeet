import type {
  CaptureType,
  Id,
  ISODateTime,
  NumericScore,
  OpportunityType,
} from "./common";
import type { ContactCandidate } from "./contact";
import type { UserObjectiveProfile } from "./user";

export type ConversationProcessingStatus =
  | "pending"
  | "processing"
  | "extracted"
  | "failed";

export interface Conversation {
  id: Id;
  userId: Id;
  contactId?: Id | null;
  rawText: string;
  captureType: CaptureType;
  transcript?: string | null;
  eventContext?: string | null;
  capturedAt: ISODateTime;
  processingStatus: ConversationProcessingStatus;
}

export interface AtomFact {
  text: string;
  type?: string;
  confidence?: NumericScore;
  isProfessional?: boolean;
  isSensitive?: boolean;
}

export interface AtomAsk {
  text: string;
  askSize?: NumericScore;
  explicitness?: NumericScore;
}

export interface AtomOffer {
  text: string;
  mutualValue?: NumericScore;
}

export interface AtomCommitment {
  text: string;
  owner?: "user" | "contact" | "shared" | "unknown";
  dueAt?: ISODateTime | null;
  explicitness?: NumericScore;
}

export interface ConversationAtoms {
  facts: AtomFact[];
  asks: AtomAsk[];
  offers: AtomOffer[];
  commitments: AtomCommitment[];
  uncertainties: string[];
  sentiment?: string | null;
  extractionConfidence: NumericScore;
}

export interface OpportunityHint {
  route: OpportunityType;
  score: NumericScore;
  evidence: string[];
}

export interface ConversationAtomsExtractionResult {
  contactCandidate: ContactCandidate;
  atoms: ConversationAtoms;
  opportunityHints: OpportunityHint[];
}

export interface ConversationSummary {
  id: Id;
  contactId?: Id | null;
  capturedAt: ISODateTime;
  captureType: CaptureType;
  summary: string;
  atoms?: ConversationAtoms;
}

export interface ProcessConversationRequest {
  requestId: Id;
  userId: Id;
  conversationId?: Id;
  captureType: CaptureType;
  rawText?: string;
  transcript?: string;
  cardText?: string;
  eventContext?: string;
}

export interface ExtractionProviderResult {
  provider: "gemini" | "fixture";
  model?: string;
  extractionConfidence: NumericScore;
  warnings: string[];
}

export interface ObjectiveAndConversationInput {
  rawText: string;
  userObjective: UserObjectiveProfile;
}
