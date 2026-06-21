import "server-only";

import {
  conversationBelongsToUser,
  createConversation,
  getActiveObjective,
  getContact,
  getDraftForRecommendation,
  getConversation,
  getRecommendation,
  getRecommendationForContact,
  listEvidenceFacts,
  listContacts,
  listOutcomes,
  listRecommendations,
  listSourceRecords,
  savePublicContext,
  saveSourceRecord,
  saveDraft,
  saveEvidenceBundle,
  saveEvidenceFact,
  saveExtractionHandoff,
  saveOpportunityRoutes,
  saveOutcome,
  saveRecommendation,
  saveUserObjective,
  setConversationContact,
  updateConversationStatus,
  upsertContact,
  upsertContactFromCandidate,
  upsertConversation,
} from "@/lib/db/queries";
import { shouldUseSupabaseDatabase } from "@/lib/db/runtime";
import {
  conversationBelongsToUserSupabase,
  createConversationSupabase,
  getActiveObjectiveSupabase,
  getContactSupabase,
  getConversationSupabase,
  getDraftForRecommendationSupabase,
  getRecommendationForContactSupabase,
  getRecommendationSupabase,
  listEvidenceFactsSupabase,
  listContactsSupabase,
  listOutcomesSupabase,
  listRecommendationsSupabase,
  listSourceRecordsSupabase,
  savePublicContextSupabase,
  saveSourceRecordSupabase,
  saveAtomsSupabase,
  saveDraftSupabase,
  saveEvidenceBundleSupabase,
  saveEvidenceFactSupabase,
  saveExtractionHandoffSupabase,
  saveOpportunityRoutesSupabase,
  saveOutcomeSupabase,
  saveRecommendationSupabase,
  saveUserObjectiveSupabase,
  setConversationContactSupabase,
  updateConversationStatusSupabase,
  upsertContactFromCandidateSupabase,
  upsertContactSupabase,
  upsertConversationSupabase,
} from "@/lib/db/supabase";
import type {
  ActionRecommendation,
  Contact,
  ContactCandidate,
  Conversation,
  ConversationAtoms,
  Draft,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  Id,
  OpportunityRoute,
  Outcome,
  PublicEntityContext,
  SourceRecord,
  UserObjectiveProfile,
  UserObjectiveProfileInput,
} from "@/lib/types";
import type { StoredConversationAtoms } from "@/lib/db/client";

export { DEMO_USER_ID } from "@/lib/db/queries";

function createId(prefix: string): Id {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function createConversationForUser(input: {
  userId: Id;
  rawText: string;
  captureType: Conversation["captureType"];
  transcript?: string | null;
  eventContext?: string | null;
  capturedAt?: string;
  conversationId?: Id;
}): Promise<Conversation> {
  if (shouldUseSupabaseDatabase()) return createConversationSupabase(input);
  return createConversation(input);
}

export async function getConversationForUser(conversationId: Id): Promise<Conversation | null> {
  if (shouldUseSupabaseDatabase()) return getConversationSupabase(conversationId);
  return getConversation(conversationId);
}

export async function upsertConversationForUser(conversation: Conversation): Promise<Conversation> {
  if (shouldUseSupabaseDatabase()) return upsertConversationSupabase(conversation);
  return upsertConversation(conversation);
}

export async function updateConversationStatusForUser(
  conversationId: Id,
  processingStatus: Conversation["processingStatus"],
): Promise<Conversation | null> {
  if (shouldUseSupabaseDatabase()) {
    return updateConversationStatusSupabase(conversationId, processingStatus);
  }
  return updateConversationStatus(conversationId, processingStatus);
}

export async function setConversationContactForUser(
  conversationId: Id,
  contactId: Id,
): Promise<Conversation | null> {
  if (shouldUseSupabaseDatabase()) return setConversationContactSupabase(conversationId, contactId);
  return setConversationContact(conversationId, contactId);
}

export async function conversationBelongsToUserId(conversationId: Id, userId: Id): Promise<boolean> {
  if (shouldUseSupabaseDatabase()) return conversationBelongsToUserSupabase(conversationId, userId);
  return conversationBelongsToUser(conversationId, userId);
}

export async function upsertContactForUser(contact: Contact): Promise<Contact> {
  if (shouldUseSupabaseDatabase()) return upsertContactSupabase(contact);
  return upsertContact(contact);
}

export async function upsertContactFromCandidateForUser(input: {
  userId: Id;
  candidate: ContactCandidate;
  sourceType: Contact["sourceType"];
  entityMatchConfidence?: number;
}): Promise<Contact | null> {
  if (shouldUseSupabaseDatabase()) return upsertContactFromCandidateSupabase(input);
  return upsertContactFromCandidate(input);
}

export async function saveAtomsForUser(input: {
  userId: Id;
  conversationId: Id;
  atoms: ConversationAtoms;
  id?: Id;
  createdAt?: string;
}): Promise<StoredConversationAtoms> {
  const id = input.id ?? createId("atoms");
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (shouldUseSupabaseDatabase()) {
    return saveAtomsSupabase(input.userId, input.conversationId, input.atoms, id, createdAt);
  }
  const { saveAtoms } = await import("@/lib/db/queries");
  return saveAtoms(input.conversationId, input.atoms, id, createdAt);
}

export async function getActiveObjectiveForUser(userId: Id): Promise<UserObjectiveProfile | null> {
  if (shouldUseSupabaseDatabase()) return getActiveObjectiveSupabase(userId);
  return getActiveObjective(userId);
}

export async function saveUserObjectiveForUser(
  input: UserObjectiveProfileInput & { id?: Id },
): Promise<UserObjectiveProfile> {
  if (shouldUseSupabaseDatabase()) return saveUserObjectiveSupabase(input);
  return saveUserObjective(input);
}

export async function getContactForUser(contactId: Id) {
  if (shouldUseSupabaseDatabase()) return getContactSupabase(contactId);
  return getContact(contactId);
}

export async function listContactsForUser(userId: Id) {
  if (shouldUseSupabaseDatabase()) return listContactsSupabase(userId);
  return listContacts(userId);
}

export async function listRecommendationsForUser(userId: Id): Promise<ActionRecommendation[]> {
  if (shouldUseSupabaseDatabase()) return listRecommendationsSupabase(userId);
  return listRecommendations(userId);
}

export async function getRecommendationForUser(id: Id): Promise<ActionRecommendation | null> {
  if (shouldUseSupabaseDatabase()) return getRecommendationSupabase(id);
  return getRecommendation(id);
}

export async function getRecommendationForContactForUser(contactId: Id): Promise<ActionRecommendation | null> {
  if (shouldUseSupabaseDatabase()) return getRecommendationForContactSupabase(contactId);
  return getRecommendationForContact(contactId);
}

export async function saveRecommendationForUser(rec: ActionRecommendation): Promise<ActionRecommendation> {
  if (shouldUseSupabaseDatabase()) return saveRecommendationSupabase(rec);
  return saveRecommendation(rec);
}

export async function listOutcomesForUser(userId: Id): Promise<Outcome[]> {
  if (shouldUseSupabaseDatabase()) return listOutcomesSupabase(userId);
  return listOutcomes(userId);
}

export async function saveOutcomeForUser(outcome: Outcome): Promise<Outcome> {
  if (shouldUseSupabaseDatabase()) return saveOutcomeSupabase(outcome);
  return saveOutcome(outcome);
}

export async function getDraftForRecommendationForUser(recommendationId: Id): Promise<Draft | null> {
  if (shouldUseSupabaseDatabase()) return getDraftForRecommendationSupabase(recommendationId);
  return getDraftForRecommendation(recommendationId);
}

export async function listSourceRecordsForContact(contactId: Id): Promise<SourceRecord[]> {
  if (shouldUseSupabaseDatabase()) return listSourceRecordsSupabase(contactId);
  return listSourceRecords(contactId);
}

export async function saveSourceRecordForUser(
  record: SourceRecord,
  userId: Id,
): Promise<SourceRecord> {
  if (shouldUseSupabaseDatabase()) return saveSourceRecordSupabase(record, userId);
  return saveSourceRecord(record);
}

export async function savePublicContextForUser(
  context: PublicEntityContext,
  userId: Id,
): Promise<PublicEntityContext> {
  if (shouldUseSupabaseDatabase()) return savePublicContextSupabase(context, userId);
  return savePublicContext(context);
}

export async function saveEvidenceFactForUser(
  fact: EvidenceFact,
  userId: Id,
): Promise<EvidenceFact> {
  if (shouldUseSupabaseDatabase()) return saveEvidenceFactSupabase(fact, userId);
  return saveEvidenceFact(fact);
}

export async function listEvidenceFactsForContact(contactId: Id): Promise<EvidenceFact[]> {
  if (shouldUseSupabaseDatabase()) return listEvidenceFactsSupabase(contactId);
  return listEvidenceFacts(contactId);
}

export async function saveExtractionHandoffForUser(
  handoff: ExtractionHandoff,
): Promise<ExtractionHandoff> {
  if (shouldUseSupabaseDatabase()) return saveExtractionHandoffSupabase(handoff);
  return saveExtractionHandoff(handoff);
}

export async function saveEvidenceBundleForUser(bundle: EvidenceBundle): Promise<EvidenceBundle> {
  if (shouldUseSupabaseDatabase()) return saveEvidenceBundleSupabase(bundle);
  return saveEvidenceBundle(bundle);
}

export async function saveOpportunityRoutesForUser(
  routes: OpportunityRoute[],
  userId: Id,
): Promise<OpportunityRoute[]> {
  if (shouldUseSupabaseDatabase()) return saveOpportunityRoutesSupabase(routes, userId);
  return saveOpportunityRoutes(routes);
}

export async function saveDraftForUser(draft: Draft, userId: Id): Promise<Draft> {
  if (shouldUseSupabaseDatabase()) return saveDraftSupabase(draft, userId);
  return saveDraft(draft);
}
