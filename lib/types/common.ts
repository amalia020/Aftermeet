export type Id = string;
export type ISODateTime = string;
export type NumericScore = number;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CaptureType = "voice" | "text" | "card";

export type WorkstreamOwner =
  | "part_1_capture_extraction"
  | "part_2_enrichment_evidence"
  | "part_3_decision_action_experience"
  | "part_5_relationship_delta";

export type ProcessStage =
  | "capturing"
  | "transcribing"
  | "extracting"
  | "persisting_atoms"
  | "resolving_entity"
  | "retrieving_context"
  | "scoring_routes"
  | "choosing_action"
  | "generating_draft"
  | "handoff_ready"
  | "failed";

export interface ProcessStageEvent {
  requestId: Id;
  conversationId?: Id;
  stage: ProcessStage;
  status: "started" | "completed" | "fallback" | "failed";
  message?: string;
  payload?: JsonValue;
  timestamp: ISODateTime;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string>;
  requestId?: Id;
}

export type OpportunityType =
  | "raise"
  | "hire"
  | "user"
  | "partner"
  | "mentor"
  | "candidate"
  | "customer"
  | "sponsor"
  | "job"
  | "community"
  | "other";

export type RecommendedActionType =
  | "SEND_FIRST_FOLLOWUP"
  | "SEND_DRAFT"
  | "SEND_NUDGE"
  | "REPLY_NOW"
  | "ASK_SHARP_QUESTION"
  | "SEND_EARLY_ACCESS"
  | "SEND_DECK"
  | "PROPOSE_COFFEE"
  | "PROPOSE_PILOT"
  | "MAKE_INTRO"
  | "WAIT"
  | "SNOOZE"
  | "DO_NOT_CONTACT"
  | "CONFIRM_DETAILS"
  | "STAY_CALM";

export type ContactStatus =
  | "new"
  | "drafted"
  | "sent"
  | "reply"
  | "booked"
  | "archived";

export type SourceProvider =
  | "cala"
  | "manual"
  | "conversation"
  | "business_card"
  | "web";

export type SourceType =
  | "user_voice_note"
  | "business_card"
  | "company_website"
  | "fund_website"
  | "official_press"
  | "reputable_news"
  | "cala_verified_fact"
  | "personal_website"
  | "search_snippet"
  | "manual"
  | "unknown";

export interface WorkstreamBoundary {
  owner: WorkstreamOwner;
  ownsPaths: string[];
  consumesContracts: string[];
  producesContracts: string[];
  blockedBy?: string[];
}
