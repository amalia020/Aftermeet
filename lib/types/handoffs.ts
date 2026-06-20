import type { Id, ISODateTime, SourceProvider, SourceType } from "./common";
import type { ContactCandidate } from "./contact";
import type { Conversation, ConversationAtoms, ExtractionProviderResult, OpportunityHint } from "./conversation";
import type {
  EntityResolutionSummary,
  EvidenceFact,
  PublicEntityContext,
  SourceRecord,
} from "./context";
import type { ActionRecommendation, DecisionTrace, Draft, FollowUpBoardCard, OpportunityRoute } from "./recommendation";
import type { UserObjectiveProfile } from "./user";

export interface CaptureSourceSummary {
  provider: Extract<SourceProvider, "conversation" | "business_card">;
  sourceType: Extract<SourceType, "user_voice_note" | "business_card" | "manual">;
  retrievedAt: ISODateTime;
  sourceConfidence: number;
}

export interface ExtractionHandoff {
  requestId: Id;
  userId: Id;
  objective: UserObjectiveProfile;
  conversation: Conversation;
  contactCandidate: ContactCandidate;
  atoms: ConversationAtoms;
  opportunityHints: OpportunityHint[];
  extraction: ExtractionProviderResult;
  sourceRecord: CaptureSourceSummary;
}

export interface EvidenceBundle {
  requestId: Id;
  userId: Id;
  conversationId: Id;
  contactId?: Id;
  contactCandidate: ContactCandidate;
  publicContext: PublicEntityContext[];
  sourceRecords: SourceRecord[];
  evidenceFacts: EvidenceFact[];
  entityResolution: EntityResolutionSummary;
  enrichment: {
    attempted: boolean;
    calaAttempted: boolean;
    webFallbackAttempted: boolean;
    status: "available" | "partial" | "public_context_unavailable" | "skipped";
    warnings: string[];
  };
}

export interface RecommendationPackage {
  recommendation: ActionRecommendation;
  routes: OpportunityRoute[];
  decisionTrace: DecisionTrace;
  draft?: Draft;
  boardCard: FollowUpBoardCard;
  warnings: string[];
}
