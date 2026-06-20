import type {
  CaptureType,
  Contact,
  ContactCandidate,
  Conversation,
  ConversationAtoms,
  ConversationProcessingStatus,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  Id,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile,
  UserObjectiveProfileInput
} from "@/lib/types";
import { DEMO_USER_ID, demoUser } from "@/lib/demo/fixtures";
import { readDatabase, updateDatabase, type ConversationAtomsRecord } from "@/lib/db/client";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): Id {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sameCandidate(contact: Contact, candidate: ContactCandidate): boolean {
  const contactName = contact.name?.toLowerCase() ?? "";
  const candidateName = candidate.name?.toLowerCase() ?? "";
  const contactCompany = contact.company?.toLowerCase() ?? "";
  const candidateCompany = candidate.company?.toLowerCase() ?? "";
  return Boolean(
    (contactName && candidateName && contactName === candidateName) ||
      (contactCompany && candidateCompany && contactCompany === candidateCompany)
  );
}

export async function ensureDemoUser(): Promise<User> {
  return updateDatabase((db) => {
    const existing = db.users.find((user) => user.id === DEMO_USER_ID);
    if (existing) return existing;
    db.users.push(demoUser);
    return demoUser;
  });
}

export async function getUser(userId: Id): Promise<User | null> {
  const db = await readDatabase();
  return db.users.find((user) => user.id === userId) ?? null;
}

export async function getActiveObjective(userId: Id): Promise<UserObjectiveProfile | null> {
  const db = await readDatabase();
  return (
    db.userObjectives
      .filter((objective) => objective.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

export async function saveUserObjective(
  input: UserObjectiveProfileInput & { id?: Id }
): Promise<UserObjectiveProfile> {
  await ensureDemoUser();
  return updateDatabase((db) => {
    const timestamp = nowIso();
    const objective: UserObjectiveProfile = {
      id: input.id ?? createId("obj"),
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
      createdAt:
        db.userObjectives.find((existing) => existing.id === input.id)?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    const index = db.userObjectives.findIndex((existing) => existing.id === objective.id);
    if (index >= 0) {
      db.userObjectives[index] = objective;
    } else {
      db.userObjectives.push(objective);
    }
    return objective;
  });
}

export async function createConversation(input: {
  userId: Id;
  rawText: string;
  captureType: CaptureType;
  transcript?: string | null;
  eventContext?: string | null;
  capturedAt?: string;
  conversationId?: Id;
}): Promise<Conversation> {
  const conversation: Conversation = {
    id: input.conversationId ?? createId("conv"),
    userId: input.userId,
    contactId: null,
    rawText: input.rawText,
    captureType: input.captureType,
    transcript: input.transcript ?? null,
    eventContext: input.eventContext ?? null,
    capturedAt: input.capturedAt ?? nowIso(),
    processingStatus: "pending"
  };

  return updateDatabase((db) => {
    const index = db.conversations.findIndex((existing) => existing.id === conversation.id);
    if (index >= 0) {
      db.conversations[index] = { ...db.conversations[index], ...conversation };
    } else {
      db.conversations.push(conversation);
    }
    return conversation;
  });
}

export async function getConversation(conversationId: Id): Promise<Conversation | null> {
  const db = await readDatabase();
  return db.conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

export async function updateConversationStatus(
  conversationId: Id,
  processingStatus: ConversationProcessingStatus
): Promise<Conversation | null> {
  return updateDatabase((db) => {
    const conversation = db.conversations.find((existing) => existing.id === conversationId);
    if (!conversation) return null;
    conversation.processingStatus = processingStatus;
    return conversation;
  });
}

export async function setConversationContact(
  conversationId: Id,
  contactId: Id
): Promise<Conversation | null> {
  return updateDatabase((db) => {
    const conversation = db.conversations.find((existing) => existing.id === conversationId);
    if (!conversation) return null;
    conversation.contactId = contactId;
    return conversation;
  });
}

export async function conversationBelongsToUser(conversationId: Id, userId: Id): Promise<boolean> {
  const conversation = await getConversation(conversationId);
  return conversation?.userId === userId;
}

export async function upsertContactFromCandidate(input: {
  userId: Id;
  candidate: ContactCandidate;
  sourceType: Contact["sourceType"];
  entityMatchConfidence?: number;
}): Promise<Contact | null> {
  const hasMeaningfulCandidate = Boolean(
    input.candidate.name ||
      input.candidate.company ||
      input.candidate.email ||
      input.candidate.website ||
      input.candidate.linkedinUrl
  );
  if (!hasMeaningfulCandidate) return null;

  return updateDatabase((db) => {
    const existing = db.contacts.find(
      (contact) => contact.userId === input.userId && sameCandidate(contact, input.candidate)
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
      existing.entityMatchConfidence =
        input.entityMatchConfidence ?? existing.entityMatchConfidence;
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
      updatedAt: timestamp
    };
    db.contacts.push(contact);
    return contact;
  });
}

export async function saveConversationAtoms(input: {
  conversationId: Id;
  atoms: ConversationAtoms;
}): Promise<ConversationAtomsRecord> {
  return updateDatabase((db) => {
    const timestamp = nowIso();
    const record: ConversationAtomsRecord = {
      id: createId("atoms"),
      conversationId: input.conversationId,
      ...input.atoms,
      createdAt: timestamp
    };
    db.conversationAtoms = db.conversationAtoms.filter(
      (existing) => existing.conversationId !== input.conversationId
    );
    db.conversationAtoms.push(record);
    return record;
  });
}

export async function saveSourceRecords(records: SourceRecord[]): Promise<SourceRecord[]> {
  return updateDatabase((db) => {
    for (const record of records) {
      const index = db.sourceRecords.findIndex((existing) => existing.id === record.id);
      if (index >= 0) db.sourceRecords[index] = record;
      else db.sourceRecords.push(record);
    }
    return records;
  });
}

export async function savePublicEntityContext(
  contexts: PublicEntityContext[]
): Promise<PublicEntityContext[]> {
  return updateDatabase((db) => {
    for (const context of contexts) {
      const index = db.publicEntityContext.findIndex((existing) => existing.id === context.id);
      if (index >= 0) db.publicEntityContext[index] = context;
      else db.publicEntityContext.push(context);
    }
    return contexts;
  });
}

export async function saveEvidenceFacts(facts: EvidenceFact[]): Promise<EvidenceFact[]> {
  return updateDatabase((db) => {
    for (const fact of facts) {
      const index = db.evidenceFacts.findIndex((existing) => existing.id === fact.id);
      if (index >= 0) db.evidenceFacts[index] = fact;
      else db.evidenceFacts.push(fact);
    }
    return facts;
  });
}

export async function saveExtractionHandoff(handoff: ExtractionHandoff): Promise<ExtractionHandoff> {
  return updateDatabase((db) => {
    db.extractionHandoffs = db.extractionHandoffs.filter(
      (existing) => existing.requestId !== handoff.requestId
    );
    db.extractionHandoffs.push(handoff);
    return handoff;
  });
}

export async function saveEvidenceBundle(bundle: EvidenceBundle): Promise<EvidenceBundle> {
  return updateDatabase((db) => {
    db.evidenceBundles = db.evidenceBundles.filter(
      (existing) => existing.requestId !== bundle.requestId
    );
    db.evidenceBundles.push(bundle);
    return bundle;
  });
}
