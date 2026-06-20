/**
 * Repository functions over the in-memory store. Grouped by table per the
 * ownership map. Every workstream goes through these helpers rather than
 * touching the Maps directly, so a future Supabase swap stays localized here.
 */

import { db, DEMO_USER_ID, type StoredConversationAtoms } from "./client";
import type {
  ActionRecommendation,
  Contact,
  Conversation,
  ConversationAtoms,
  Draft,
  EvidenceFact,
  OpportunityRoute,
  Outcome,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile,
} from "@/lib/types";

export { DEMO_USER_ID };

// ---------- Users & objectives (Part 1 owned tables) ----------

export function getUser(userId: string): User | undefined {
  return db().users.get(userId);
}

export function upsertUser(user: User): User {
  db().users.set(user.id, user);
  return user;
}

export function getActiveObjective(
  userId: string,
): UserObjectiveProfile | undefined {
  const all = [...db().userObjectives.values()].filter(
    (o) => o.userId === userId,
  );
  if (all.length === 0) return undefined;
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function upsertObjective(
  objective: UserObjectiveProfile,
): UserObjectiveProfile {
  db().userObjectives.set(objective.id, objective);
  return objective;
}

// ---------- Contacts (Part 1) ----------

export function getContact(contactId: string): Contact | undefined {
  return db().contacts.get(contactId);
}

export function listContacts(userId: string): Contact[] {
  return [...db().contacts.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertContact(contact: Contact): Contact {
  db().contacts.set(contact.id, contact);
  return contact;
}

export function deleteContact(contactId: string): void {
  const store = db();
  store.contacts.delete(contactId);
  for (const [id, fact] of store.evidenceFacts) {
    if (fact.contactId === contactId) store.evidenceFacts.delete(id);
  }
  for (const [id, ctx] of store.publicEntityContext) {
    if (ctx.contactId === contactId) store.publicEntityContext.delete(id);
  }
  for (const [id, src] of store.sourceRecords) {
    if (src.contactId === contactId) store.sourceRecords.delete(id);
  }
}

// ---------- Conversations & atoms (Part 1) ----------

export function getConversation(id: string): Conversation | undefined {
  return db().conversations.get(id);
}

export function listConversations(userId: string): Conversation[] {
  return [...db().conversations.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function upsertConversation(conversation: Conversation): Conversation {
  db().conversations.set(conversation.id, conversation);
  return conversation;
}

export function saveAtoms(
  conversationId: string,
  atoms: ConversationAtoms,
  id: string,
  createdAt: string,
): StoredConversationAtoms {
  const record: StoredConversationAtoms = {
    ...atoms,
    id,
    conversationId,
    createdAt,
  };
  db().conversationAtoms.set(id, record);
  return record;
}

export function getAtomsForConversation(
  conversationId: string,
): StoredConversationAtoms | undefined {
  return [...db().conversationAtoms.values()].find(
    (a) => a.conversationId === conversationId,
  );
}

// ---------- Enrichment tables (Part 2) ----------

export function savePublicContext(ctx: PublicEntityContext): PublicEntityContext {
  db().publicEntityContext.set(ctx.id, ctx);
  return ctx;
}

export function listPublicContext(contactId: string): PublicEntityContext[] {
  return [...db().publicEntityContext.values()].filter(
    (c) => c.contactId === contactId,
  );
}

export function saveSourceRecord(record: SourceRecord): SourceRecord {
  db().sourceRecords.set(record.id, record);
  return record;
}

export function listSourceRecords(contactId: string): SourceRecord[] {
  return [...db().sourceRecords.values()].filter(
    (s) => s.contactId === contactId,
  );
}

export function saveEvidenceFact(fact: EvidenceFact): EvidenceFact {
  db().evidenceFacts.set(fact.id, fact);
  return fact;
}

export function listEvidenceFacts(contactId: string): EvidenceFact[] {
  return [...db().evidenceFacts.values()].filter(
    (f) => f.contactId === contactId,
  );
}

export function deleteEvidenceFact(factId: string): void {
  db().evidenceFacts.delete(factId);
}

// ---------- Decision tables (Part 3) ----------

export function saveOpportunityRoutes(
  routes: OpportunityRoute[],
): OpportunityRoute[] {
  for (const route of routes) {
    if (route.id) db().opportunityRoutes.set(route.id, route);
  }
  return routes;
}

export function saveRecommendation(
  rec: ActionRecommendation,
): ActionRecommendation {
  db().actionRecommendations.set(rec.id, rec);
  return rec;
}

export function getRecommendation(
  id: string,
): ActionRecommendation | undefined {
  return db().actionRecommendations.get(id);
}

export function listRecommendations(userId: string): ActionRecommendation[] {
  return [...db().actionRecommendations.values()]
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRecommendationForContact(
  contactId: string,
): ActionRecommendation | undefined {
  return [...db().actionRecommendations.values()]
    .filter((r) => r.contactId === contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function saveDraft(draft: Draft): Draft {
  db().drafts.set(draft.id, draft);
  return draft;
}

export function getDraftForRecommendation(
  recommendationId: string,
): Draft | undefined {
  return [...db().drafts.values()].find(
    (d) => d.recommendationId === recommendationId,
  );
}

export function saveOutcome(outcome: Outcome): Outcome {
  db().outcomes.set(outcome.id, outcome);
  return outcome;
}

export function listOutcomes(userId: string): Outcome[] {
  return [...db().outcomes.values()]
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
