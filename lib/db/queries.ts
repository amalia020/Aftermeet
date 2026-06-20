import type {
  ActionRecommendation,
  CaptureType,
  Contact,
  ContactCandidate,
  Conversation,
  ConversationAtoms,
  ConversationProcessingStatus,
  Draft,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  Id,
  OpportunityRoute,
  Outcome,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile,
  UserObjectiveProfileInput,
} from "@/lib/types";
import { DEMO_USER_ID, demoUser } from "@/lib/demo/fixtures";
import {
  readDatabase,
  updateDatabase,
  type StoredConversationAtoms,
} from "@/lib/db/client";

export { DEMO_USER_ID };

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): Id {
  return `${prefix}_${crypto.randomUUID()}`;
}

function upsertById<T extends { id?: string }>(items: T[], item: T): T {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  return item;
}

function sameCandidate(contact: Contact, candidate: ContactCandidate): boolean {
  const contactName = contact.name?.toLowerCase() ?? "";
  const candidateName = candidate.name?.toLowerCase() ?? "";
  const contactCompany = contact.company?.toLowerCase() ?? "";
  const candidateCompany = candidate.company?.toLowerCase() ?? "";
  return Boolean(
    (contactName && candidateName && contactName === candidateName) ||
      (contactCompany && candidateCompany && contactCompany === candidateCompany),
  );
}

export function ensureDemoUser(): User {
  return updateDatabase((db) => {
    const existing = db.users.find((user) => user.id === DEMO_USER_ID);
    if (existing) return existing;
    db.users.push(demoUser);
    return demoUser;
  });
}

export function getUser(userId: Id): User | null {
  return readDatabase().users.find((user) => user.id === userId) ?? null;
}

export function upsertUser(user: User): User {
  return updateDatabase((db) => upsertById(db.users, user));
}

export function getActiveObjective(userId: Id): UserObjectiveProfile | null {
  return (
    readDatabase()
      .userObjectives.filter((objective) => objective.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

export function saveUserObjective(
  input: UserObjectiveProfileInput & { id?: Id },
): UserObjectiveProfile {
  ensureDemoUser();
  return updateDatabase((db) => {
    const timestamp = nowIso();
    const existing = input.id
      ? db.userObjectives.find((objective) => objective.id === input.id)
      : db.userObjectives
          .filter((objective) => objective.userId === input.userId)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const objective: UserObjectiveProfile = {
      id: input.id ?? existing?.id ?? createId("obj"),
      userId: input.userId,
      role: input.role,
      activeGoals: input.activeGoals?.length ? input.activeGoals : [input.primaryGoal],
      primaryGoal: input.primaryGoal,
      secondaryGoals: input.secondaryGoals ?? [],
      eventContext: input.eventContext ?? null,
      companyName: input.companyName ?? null,
      companyStage: input.companyStage ?? null,
      productDescription: input.productDescription ?? null,
      targetCustomer: input.targetCustomer ?? null,
      currentTraction: input.currentTraction ?? null,
      fundraisingStatus: input.fundraisingStatus ?? null,
      hiringNeeds: input.hiringNeeds ?? [],
      attentionBudgetToday: input.attentionBudgetToday ?? 5,
      preferredTone: input.preferredTone ?? "warm",
      constraints: input.constraints ?? [],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return upsertById(db.userObjectives, objective);
  });
}

export function upsertObjective(objective: UserObjectiveProfile): UserObjectiveProfile {
  return updateDatabase((db) => upsertById(db.userObjectives, objective));
}

export function createConversation(input: {
  userId: Id;
  rawText: string;
  captureType: CaptureType;
  transcript?: string | null;
  eventContext?: string | null;
  capturedAt?: string;
  conversationId?: Id;
}): Conversation {
  const conversation: Conversation = {
    id: input.conversationId ?? createId("conv"),
    userId: input.userId,
    contactId: null,
    rawText: input.rawText,
    captureType: input.captureType,
    transcript: input.transcript ?? null,
    eventContext: input.eventContext ?? null,
    capturedAt: input.capturedAt ?? nowIso(),
    processingStatus: "pending",
  };
  return upsertConversation(conversation);
}

export function getConversation(conversationId: Id): Conversation | null {
  return readDatabase().conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

export function listConversations(userId: Id): Conversation[] {
  return readDatabase()
    .conversations.filter((conversation) => conversation.userId === userId)
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
}

export function upsertConversation(conversation: Conversation): Conversation {
  return updateDatabase((db) => upsertById(db.conversations, conversation));
}

export function updateConversationStatus(
  conversationId: Id,
  processingStatus: ConversationProcessingStatus,
): Conversation | null {
  return updateDatabase((db) => {
    const conversation = db.conversations.find((existing) => existing.id === conversationId);
    if (!conversation) return null;
    conversation.processingStatus = processingStatus;
    return conversation;
  });
}

export function setConversationContact(conversationId: Id, contactId: Id): Conversation | null {
  return updateDatabase((db) => {
    const conversation = db.conversations.find((existing) => existing.id === conversationId);
    if (!conversation) return null;
    conversation.contactId = contactId;
    return conversation;
  });
}

export function conversationBelongsToUser(conversationId: Id, userId: Id): boolean {
  return getConversation(conversationId)?.userId === userId;
}

export function getContact(contactId: Id): Contact | null {
  return readDatabase().contacts.find((contact) => contact.id === contactId) ?? null;
}

export function listContacts(userId: Id): Contact[] {
  return readDatabase()
    .contacts.filter((contact) => contact.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function upsertContact(contact: Contact): Contact {
  return updateDatabase((db) => upsertById(db.contacts, contact));
}

export function upsertContactFromCandidate(input: {
  userId: Id;
  candidate: ContactCandidate;
  sourceType: Contact["sourceType"];
  entityMatchConfidence?: number;
}): Contact | null {
  const hasMeaningfulCandidate = Boolean(
    input.candidate.name ||
      input.candidate.company ||
      input.candidate.email ||
      input.candidate.website ||
      input.candidate.linkedinUrl,
  );
  if (!hasMeaningfulCandidate) return null;

  return updateDatabase((db) => {
    const existing = db.contacts.find(
      (contact) => contact.userId === input.userId && sameCandidate(contact, input.candidate),
    );
    const timestamp = nowIso();
    if (existing) {
      existing.name = input.candidate.name ?? existing.name ?? null;
      existing.role = input.candidate.role ?? existing.role ?? null;
      existing.company = input.candidate.company ?? existing.company ?? null;
      existing.email = input.candidate.email ?? existing.email ?? null;
      existing.phone = input.candidate.phone ?? existing.phone ?? null;
      existing.website = input.candidate.website ?? existing.website ?? null;
      existing.linkedinUrl = input.candidate.linkedinUrl ?? existing.linkedinUrl ?? null;
      existing.entityMatchConfidence = input.entityMatchConfidence ?? existing.entityMatchConfidence;
      existing.updatedAt = timestamp;
      return existing;
    }

    const contact: Contact = {
      id: createId("contact"),
      userId: input.userId,
      name: input.candidate.name ?? null,
      role: input.candidate.role ?? null,
      company: input.candidate.company ?? null,
      email: input.candidate.email ?? null,
      phone: input.candidate.phone ?? null,
      website: input.candidate.website ?? null,
      linkedinUrl: input.candidate.linkedinUrl ?? null,
      sourceType: input.sourceType,
      entityMatchConfidence: input.entityMatchConfidence ?? 0.5,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.contacts.push(contact);
    return contact;
  });
}

export function deleteContact(contactId: Id): void {
  updateDatabase((db) => {
    db.contacts = db.contacts.filter((contact) => contact.id !== contactId);
    db.evidenceFacts = db.evidenceFacts.filter((fact) => fact.contactId !== contactId);
    db.publicEntityContext = db.publicEntityContext.filter((context) => context.contactId !== contactId);
    db.sourceRecords = db.sourceRecords.filter((source) => source.contactId !== contactId);
  });
}

export function saveConversationAtoms(input: {
  conversationId: Id;
  atoms: ConversationAtoms;
}): StoredConversationAtoms {
  return saveAtoms(input.conversationId, input.atoms, createId("atoms"), nowIso());
}

export function saveAtoms(
  conversationId: Id,
  atoms: ConversationAtoms,
  id: Id,
  createdAt: string,
): StoredConversationAtoms {
  return updateDatabase((db) => {
    const record: StoredConversationAtoms = {
      id,
      conversationId,
      ...atoms,
      createdAt,
    };
    db.conversationAtoms = db.conversationAtoms.filter(
      (existing) => existing.conversationId !== conversationId,
    );
    db.conversationAtoms.push(record);
    return record;
  });
}

export function getAtomsForConversation(conversationId: Id): StoredConversationAtoms | null {
  return readDatabase().conversationAtoms.find((atoms) => atoms.conversationId === conversationId) ?? null;
}

export function saveSourceRecords(records: SourceRecord[]): SourceRecord[] {
  return updateDatabase((db) => {
    for (const record of records) upsertById(db.sourceRecords, record);
    return records;
  });
}

export function saveSourceRecord(record: SourceRecord): SourceRecord {
  return saveSourceRecords([record])[0];
}

export function listSourceRecords(contactId: Id): SourceRecord[] {
  return readDatabase().sourceRecords.filter((source) => source.contactId === contactId);
}

export function savePublicEntityContext(
  contexts: PublicEntityContext[],
): PublicEntityContext[] {
  return updateDatabase((db) => {
    for (const context of contexts) upsertById(db.publicEntityContext, context);
    return contexts;
  });
}

export function savePublicContext(context: PublicEntityContext): PublicEntityContext {
  return savePublicEntityContext([context])[0];
}

export function listPublicContext(contactId: Id): PublicEntityContext[] {
  return readDatabase().publicEntityContext.filter((context) => context.contactId === contactId);
}

export function saveEvidenceFacts(facts: EvidenceFact[]): EvidenceFact[] {
  return updateDatabase((db) => {
    for (const fact of facts) upsertById(db.evidenceFacts, fact);
    return facts;
  });
}

export function saveEvidenceFact(fact: EvidenceFact): EvidenceFact {
  return saveEvidenceFacts([fact])[0];
}

export function listEvidenceFacts(contactId: Id): EvidenceFact[] {
  return readDatabase().evidenceFacts.filter((fact) => fact.contactId === contactId);
}

export function deleteEvidenceFact(factId: Id): void {
  updateDatabase((db) => {
    db.evidenceFacts = db.evidenceFacts.filter((fact) => fact.id !== factId);
  });
}

export function saveExtractionHandoff(handoff: ExtractionHandoff): ExtractionHandoff {
  return updateDatabase((db) => {
    db.extractionHandoffs = db.extractionHandoffs.filter(
      (existing) => existing.requestId !== handoff.requestId,
    );
    db.extractionHandoffs.push(handoff);
    return handoff;
  });
}

export function saveEvidenceBundle(bundle: EvidenceBundle): EvidenceBundle {
  return updateDatabase((db) => {
    db.evidenceBundles = db.evidenceBundles.filter(
      (existing) => existing.requestId !== bundle.requestId,
    );
    db.evidenceBundles.push(bundle);
    return bundle;
  });
}

export function listEvidenceBundles(userId: Id): EvidenceBundle[] {
  return readDatabase().evidenceBundles.filter((bundle) => bundle.userId === userId);
}

export function getEvidenceBundleForConversation(conversationId: Id): EvidenceBundle | null {
  return (
    readDatabase().evidenceBundles.find(
      (bundle) => bundle.conversationId === conversationId,
    ) ?? null
  );
}

export function saveOpportunityRoutes(routes: OpportunityRoute[]): OpportunityRoute[] {
  return updateDatabase((db) => {
    for (const route of routes) {
      if (route.id) upsertById(db.opportunityRoutes, route);
    }
    return routes;
  });
}

export function saveRecommendation(rec: ActionRecommendation): ActionRecommendation {
  return updateDatabase((db) => upsertById(db.actionRecommendations, rec));
}

export function getRecommendation(id: Id): ActionRecommendation | null {
  return readDatabase().actionRecommendations.find((rec) => rec.id === id) ?? null;
}

export function listRecommendations(userId: Id): ActionRecommendation[] {
  return readDatabase()
    .actionRecommendations.filter((rec) => rec.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getRecommendationForContact(contactId: Id): ActionRecommendation | null {
  return (
    readDatabase()
      .actionRecommendations.filter((rec) => rec.contactId === contactId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function saveDraft(draft: Draft): Draft {
  return updateDatabase((db) => upsertById(db.drafts, draft));
}

export function getDraftForRecommendation(recommendationId: Id): Draft | null {
  return readDatabase().drafts.find((draft) => draft.recommendationId === recommendationId) ?? null;
}

export function saveOutcome(outcome: Outcome): Outcome {
  return updateDatabase((db) => upsertById(db.outcomes, outcome));
}

export function listOutcomes(userId: Id): Outcome[] {
  return readDatabase()
    .outcomes.filter((outcome) => outcome.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
