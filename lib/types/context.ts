import type {
  Id,
  ISODateTime,
  JsonValue,
  NumericScore,
  SourceProvider,
  SourceType,
} from "./common";

export type PublicContextProvider = "cala" | "gemini" | "web" | "manual";
export type EntityType = "person" | "company" | "fund" | "unknown";

export interface PublicEntityContext {
  id: Id;
  contactId?: Id | null;
  provider: PublicContextProvider;
  providerEntityId?: string | null;
  entityType: EntityType;
  canonicalName?: string | null;
  rawContext: JsonValue;
  retrievedAt: ISODateTime;
  confidence: NumericScore;
}

export interface SourceRecord {
  id: Id;
  contactId?: Id | null;
  provider: SourceProvider;
  sourceType: SourceType;
  sourceName?: string | null;
  sourceUrl?: string | null;
  retrievedAt: ISODateTime;
  sourceConfidence: NumericScore;
  notes?: string | null;
}

export interface EvidenceFact {
  id: Id;
  contactId?: Id | null;
  conversationId: Id;
  fact: string;
  factType?: string | null;
  sourceRecordId?: Id | null;
  sourceType: SourceType;
  entityMatchConfidence: NumericScore;
  sourceConfidence: NumericScore;
  extractionConfidence: NumericScore;
  freshness: NumericScore;
  contradictionPenalty: NumericScore;
  factConfidence: NumericScore;
  safeForDraft: boolean;
  isProfessional: boolean;
  isSensitive: boolean;
  createdAt: ISODateTime;
}

export type EntityMatchLabel = "high" | "medium" | "low" | "no_match";

export interface EntityResolutionSummary {
  capturedName?: string;
  capturedCompany?: string;
  capturedRole?: string;
  capturedDomain?: string;
  candidateName?: string;
  candidateCompany?: string;
  candidateRole?: string;
  candidateDomain?: string;
  score: NumericScore;
  label: EntityMatchLabel;
  needsUserConfirmation: boolean;
  reasons: string[];
}

export interface WebContextClaim {
  text: string;
  sourceUrl: string;
  sourceType: SourceType;
}

export interface WebContextResult {
  summary: string;
  claims: WebContextClaim[];
  retrievedAt: ISODateTime;
  available: boolean;
}

export interface CalaEntityCandidate {
  providerEntityId: string;
  name: string;
  entityType: EntityType;
  company?: string;
  role?: string;
  domain?: string;
  confidence?: NumericScore;
}

export interface CalaSearchResult {
  available: boolean;
  candidates: CalaEntityCandidate[];
  rawResponse?: JsonValue;
  warnings: string[];
}

export interface CalaQueryResult {
  available: boolean;
  answer?: string;
  facts: string[];
  rawResponse?: JsonValue;
  warnings: string[];
}

export interface CalaEntityDetail {
  providerEntityId: string;
  entityType: EntityType;
  canonicalName: string;
  rawContext: JsonValue;
  retrievedAt: ISODateTime;
}
