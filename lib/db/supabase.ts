import "server-only";

import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";
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

type ObjectiveRow = {
  id: string;
  user_id: string;
  role: UserObjectiveProfile["role"];
  primary_goal: UserObjectiveProfile["primaryGoal"];
  active_goals: UserObjectiveProfile["activeGoals"] | null;
  secondary_goals: UserObjectiveProfile["secondaryGoals"] | null;
  event_context: string | null;
  company_name: string | null;
  company_stage: string | null;
  product_description: string | null;
  target_customer: string | null;
  current_traction: string | null;
  fundraising_status: string | null;
  hiring_needs: string[] | null;
  attention_budget_today: number | null;
  preferred_tone: UserObjectiveProfile["preferredTone"] | null;
  constraints: string[] | null;
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: string;
  user_id: string;
  name: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  source_type: Contact["sourceType"];
  entity_match_confidence: number | null;
  created_at: string;
  updated_at: string;
};

type ConversationRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  raw_text: string;
  capture_type: Conversation["captureType"];
  transcript: string | null;
  event_context: string | null;
  captured_at: string;
  processing_status: Conversation["processingStatus"];
};

type ConversationAtomsRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  facts: ConversationAtoms["facts"] | null;
  asks: ConversationAtoms["asks"] | null;
  offers: ConversationAtoms["offers"] | null;
  commitments: ConversationAtoms["commitments"] | null;
  uncertainties: string[] | null;
  sentiment: string | null;
  extraction_confidence: number | null;
  created_at: string;
};

type SourceRecordRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  provider: SourceRecord["provider"];
  source_type: SourceRecord["sourceType"];
  source_name: string | null;
  source_url: string | null;
  retrieved_at: string;
  source_confidence: number;
  notes: string | null;
};

type PublicEntityContextRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  provider: PublicEntityContext["provider"];
  provider_entity_id: string | null;
  entity_type: PublicEntityContext["entityType"];
  canonical_name: string | null;
  raw_context: PublicEntityContext["rawContext"];
  retrieved_at: string;
  confidence: number;
};

type EvidenceFactRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string;
  fact: string;
  fact_type: string | null;
  source_record_id: string | null;
  source_type: EvidenceFact["sourceType"];
  entity_match_confidence: number;
  source_confidence: number;
  extraction_confidence: number;
  freshness: number;
  contradiction_penalty: number;
  fact_confidence: number;
  safe_for_draft: boolean;
  is_professional: boolean;
  is_sensitive: boolean;
  created_at: string;
};

type EvidenceBundleRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  request_id: string;
  payload: EvidenceBundle;
  created_at: string;
};

type ExtractionHandoffRow = {
  request_id: string;
  user_id: string;
  payload: ExtractionHandoff;
  created_at: string;
};

type OpportunityRouteRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  type: OpportunityRoute["type"];
  score: number;
  evidence: string[] | null;
  why: string[] | null;
  why_not: string[] | null;
  created_at: string;
};

type RecommendationRow = {
  id: string;
  user_id: string;
  contact_id: string;
  conversation_id: string;
  recommended_action: ActionRecommendation["recommendedAction"];
  priority_score: number;
  urgency_score: number;
  recipient_burden: number;
  confidence: number;
  status: ActionRecommendation["status"];
  explanation: ActionRecommendation["explanation"];
  created_at: string;
};

type OutcomeRow = {
  id: string;
  user_id: string;
  contact_id: string;
  recommendation_id: string | null;
  outcome_type: Outcome["outcomeType"];
  notes: string | null;
  value: number | null;
  created_at: string;
};

type DraftRow = {
  id: string;
  user_id: string;
  recommendation_id: string;
  contact_id: string;
  channel: Draft["channel"];
  tone: string | null;
  subject: string | null;
  body: string;
  facts_used: string[] | null;
  status: Draft["status"];
  risk_note: string | null;
  created_at: string;
  sent_at: string | null;
};

function requireClient() {
  return createSupabaseServerClient().then((client) => {
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  });
}

function objectiveFromRow(row: ObjectiveRow): UserObjectiveProfile {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    primaryGoal: row.primary_goal,
    activeGoals: row.active_goals?.length ? row.active_goals : [row.primary_goal],
    secondaryGoals: row.secondary_goals ?? [],
    eventContext: row.event_context,
    companyName: row.company_name,
    companyStage: row.company_stage,
    productDescription: row.product_description,
    targetCustomer: row.target_customer,
    currentTraction: row.current_traction,
    fundraisingStatus: row.fundraising_status,
    hiringNeeds: row.hiring_needs ?? [],
    attentionBudgetToday: row.attention_budget_today ?? 3,
    preferredTone: row.preferred_tone ?? "warm",
    constraints: row.constraints ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function objectiveToRow(
  input: UserObjectiveProfileInput & { id?: Id },
): Partial<ObjectiveRow> {
  return {
    id: input.id,
    user_id: input.userId,
    role: input.role,
    primary_goal: input.primaryGoal,
    active_goals: input.activeGoals?.length ? input.activeGoals : [input.primaryGoal],
    secondary_goals: input.secondaryGoals ?? [],
    event_context: input.eventContext ?? null,
    company_name: input.companyName ?? null,
    company_stage: input.companyStage ?? null,
    product_description: input.productDescription ?? null,
    target_customer: input.targetCustomer ?? null,
    current_traction: input.currentTraction ?? null,
    fundraising_status: input.fundraisingStatus ?? null,
    hiring_needs: input.hiringNeeds ?? [],
    attention_budget_today: input.attentionBudgetToday ?? 3,
    preferred_tone: input.preferredTone ?? "warm",
    constraints: input.constraints ?? [],
    updated_at: new Date().toISOString(),
  };
}

function contactFromRow(row: ContactRow): Contact {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    company: row.company,
    email: row.email,
    phone: row.phone,
    website: row.website,
    linkedinUrl: row.linkedin_url,
    sourceType: row.source_type,
    entityMatchConfidence: row.entity_match_confidence ?? 0.5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactToRow(contact: Contact): ContactRow {
  return {
    id: contact.id,
    user_id: contact.userId,
    name: contact.name ?? null,
    role: contact.role ?? null,
    company: contact.company ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    website: contact.website ?? null,
    linkedin_url: contact.linkedinUrl ?? null,
    source_type: contact.sourceType,
    entity_match_confidence: contact.entityMatchConfidence,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    rawText: row.raw_text,
    captureType: row.capture_type,
    transcript: row.transcript,
    eventContext: row.event_context,
    capturedAt: row.captured_at,
    processingStatus: row.processing_status,
  };
}

function conversationToRow(conversation: Conversation): ConversationRow {
  return {
    id: conversation.id,
    user_id: conversation.userId,
    contact_id: conversation.contactId ?? null,
    raw_text: conversation.rawText,
    capture_type: conversation.captureType,
    transcript: conversation.transcript ?? null,
    event_context: conversation.eventContext ?? null,
    captured_at: conversation.capturedAt,
    processing_status: conversation.processingStatus,
  };
}

function atomsFromRow(row: ConversationAtomsRow): StoredConversationAtoms {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    facts: row.facts ?? [],
    asks: row.asks ?? [],
    offers: row.offers ?? [],
    commitments: row.commitments ?? [],
    uncertainties: row.uncertainties ?? [],
    sentiment: row.sentiment,
    extractionConfidence: row.extraction_confidence ?? 0,
    createdAt: row.created_at,
  };
}

function sourceRecordFromRow(row: SourceRecordRow): SourceRecord {
  return {
    id: row.id,
    contactId: row.contact_id,
    provider: row.provider,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    retrievedAt: row.retrieved_at,
    sourceConfidence: row.source_confidence,
    notes: row.notes,
  };
}

function sourceRecordToRow(record: SourceRecord, userId: Id): SourceRecordRow {
  return {
    id: record.id,
    user_id: userId,
    contact_id: record.contactId ?? null,
    provider: record.provider,
    source_type: record.sourceType,
    source_name: record.sourceName ?? null,
    source_url: record.sourceUrl ?? null,
    retrieved_at: record.retrievedAt,
    source_confidence: record.sourceConfidence,
    notes: record.notes ?? null,
  };
}

function publicContextFromRow(row: PublicEntityContextRow): PublicEntityContext {
  return {
    id: row.id,
    contactId: row.contact_id,
    provider: row.provider,
    providerEntityId: row.provider_entity_id,
    entityType: row.entity_type,
    canonicalName: row.canonical_name,
    rawContext: row.raw_context,
    retrievedAt: row.retrieved_at,
    confidence: row.confidence,
  };
}

function publicContextToRow(context: PublicEntityContext, userId: Id): PublicEntityContextRow {
  return {
    id: context.id,
    user_id: userId,
    contact_id: context.contactId ?? null,
    provider: context.provider,
    provider_entity_id: context.providerEntityId ?? null,
    entity_type: context.entityType,
    canonical_name: context.canonicalName ?? null,
    raw_context: context.rawContext,
    retrieved_at: context.retrievedAt,
    confidence: context.confidence,
  };
}

function evidenceFactFromRow(row: EvidenceFactRow): EvidenceFact {
  return {
    id: row.id,
    contactId: row.contact_id,
    conversationId: row.conversation_id,
    fact: row.fact,
    factType: row.fact_type,
    sourceRecordId: row.source_record_id,
    sourceType: row.source_type,
    entityMatchConfidence: row.entity_match_confidence,
    sourceConfidence: row.source_confidence,
    extractionConfidence: row.extraction_confidence,
    freshness: row.freshness,
    contradictionPenalty: row.contradiction_penalty,
    factConfidence: row.fact_confidence,
    safeForDraft: row.safe_for_draft,
    isProfessional: row.is_professional,
    isSensitive: row.is_sensitive,
    createdAt: row.created_at,
  };
}

function evidenceFactToRow(fact: EvidenceFact, userId: Id): EvidenceFactRow {
  return {
    id: fact.id,
    user_id: userId,
    contact_id: fact.contactId ?? null,
    conversation_id: fact.conversationId,
    fact: fact.fact,
    fact_type: fact.factType ?? null,
    source_record_id: fact.sourceRecordId ?? null,
    source_type: fact.sourceType,
    entity_match_confidence: fact.entityMatchConfidence,
    source_confidence: fact.sourceConfidence,
    extraction_confidence: fact.extractionConfidence,
    freshness: fact.freshness,
    contradiction_penalty: fact.contradictionPenalty,
    fact_confidence: fact.factConfidence,
    safe_for_draft: fact.safeForDraft,
    is_professional: fact.isProfessional,
    is_sensitive: fact.isSensitive,
    created_at: fact.createdAt,
  };
}

function opportunityRouteFromRow(row: OpportunityRouteRow): OpportunityRoute {
  return {
    id: row.id,
    contactId: row.contact_id ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    type: row.type,
    score: row.score,
    evidence: row.evidence ?? [],
    why: row.why ?? [],
    whyNot: row.why_not ?? [],
    createdAt: row.created_at,
  };
}

function opportunityRouteToRow(route: OpportunityRoute, userId: Id): OpportunityRouteRow {
  return {
    id: route.id ?? `${route.type}_${crypto.randomUUID()}`,
    user_id: userId,
    contact_id: route.contactId ?? null,
    conversation_id: route.conversationId ?? null,
    type: route.type,
    score: route.score,
    evidence: route.evidence,
    why: route.why,
    why_not: route.whyNot,
    created_at: route.createdAt ?? new Date().toISOString(),
  };
}

function recommendationFromRow(row: RecommendationRow): ActionRecommendation {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    conversationId: row.conversation_id,
    recommendedAction: row.recommended_action,
    priorityScore: row.priority_score,
    urgencyScore: row.urgency_score,
    recipientBurden: row.recipient_burden,
    confidence: row.confidence,
    status: row.status,
    explanation: row.explanation,
    createdAt: row.created_at,
  };
}

function recommendationToRow(rec: ActionRecommendation): RecommendationRow {
  return {
    id: rec.id,
    user_id: rec.userId,
    contact_id: rec.contactId,
    conversation_id: rec.conversationId,
    recommended_action: rec.recommendedAction,
    priority_score: rec.priorityScore,
    urgency_score: rec.urgencyScore,
    recipient_burden: rec.recipientBurden,
    confidence: rec.confidence,
    status: rec.status,
    explanation: rec.explanation,
    created_at: rec.createdAt,
  };
}

function outcomeFromRow(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    recommendationId: row.recommendation_id,
    outcomeType: row.outcome_type,
    notes: row.notes,
    value: row.value,
    createdAt: row.created_at,
  };
}

function outcomeToRow(outcome: Outcome): OutcomeRow {
  return {
    id: outcome.id,
    user_id: outcome.userId,
    contact_id: outcome.contactId,
    recommendation_id: outcome.recommendationId ?? null,
    outcome_type: outcome.outcomeType,
    notes: outcome.notes ?? null,
    value: outcome.value ?? null,
    created_at: outcome.createdAt,
  };
}

function draftFromRow(row: DraftRow): Draft {
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    contactId: row.contact_id,
    channel: row.channel,
    tone: row.tone,
    subject: row.subject,
    body: row.body,
    factsUsed: row.facts_used ?? [],
    status: row.status,
    riskNote: row.risk_note,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

function draftToRow(draft: Draft, userId: Id): DraftRow {
  return {
    id: draft.id,
    user_id: userId,
    recommendation_id: draft.recommendationId,
    contact_id: draft.contactId,
    channel: draft.channel,
    tone: draft.tone ?? null,
    subject: draft.subject ?? null,
    body: draft.body,
    facts_used: draft.factsUsed,
    status: draft.status,
    risk_note: draft.riskNote ?? null,
    created_at: draft.createdAt,
    sent_at: draft.sentAt ?? null,
  };
}

export async function createConversationSupabase(input: {
  userId: Id;
  rawText: string;
  captureType: Conversation["captureType"];
  transcript?: string | null;
  eventContext?: string | null;
  capturedAt?: string;
  conversationId?: Id;
}): Promise<Conversation> {
  return upsertConversationSupabase({
    id: input.conversationId ?? `conv_${crypto.randomUUID()}`,
    userId: input.userId,
    contactId: null,
    rawText: input.rawText,
    captureType: input.captureType,
    transcript: input.transcript ?? null,
    eventContext: input.eventContext ?? null,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    processingStatus: "pending",
  });
}

export async function getConversationSupabase(conversationId: Id): Promise<Conversation | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data ? conversationFromRow(data) : null;
}

export async function upsertConversationSupabase(conversation: Conversation): Promise<Conversation> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .upsert(conversationToRow(conversation))
    .select("*")
    .single<ConversationRow>();
  if (error) throw error;
  return conversationFromRow(data);
}

export async function updateConversationStatusSupabase(
  conversationId: Id,
  processingStatus: Conversation["processingStatus"],
): Promise<Conversation | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({ processing_status: processingStatus })
    .eq("id", conversationId)
    .select("*")
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data ? conversationFromRow(data) : null;
}

export async function setConversationContactSupabase(
  conversationId: Id,
  contactId: Id,
): Promise<Conversation | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({ contact_id: contactId })
    .eq("id", conversationId)
    .select("*")
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  return data ? conversationFromRow(data) : null;
}

export async function conversationBelongsToUserSupabase(
  conversationId: Id,
  userId: Id,
): Promise<boolean> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return Boolean(data);
}

export async function upsertContactSupabase(contact: Contact): Promise<Contact> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("contacts")
    .upsert(contactToRow(contact))
    .select("*")
    .single<ContactRow>();
  if (error) throw error;
  return contactFromRow(data);
}

export async function upsertContactFromCandidateSupabase(input: {
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
      input.candidate.linkedinUrl,
  );
  if (!hasMeaningfulCandidate) return null;

  const supabase = await requireClient();
  let query = supabase.from("contacts").select("*").eq("user_id", input.userId).limit(1);
  if (input.candidate.email) query = query.eq("email", input.candidate.email);
  else if (input.candidate.name) query = query.eq("name", input.candidate.name);
  else query = query.eq("company", input.candidate.company);
  const { data: existingRows, error: lookupError } = await query;
  if (lookupError) throw lookupError;

  const timestamp = new Date().toISOString();
  const existing = (existingRows?.[0] as ContactRow | undefined) ?? null;
  return upsertContactSupabase({
    id: existing?.id ?? `contact_${crypto.randomUUID()}`,
    userId: input.userId,
    name: input.candidate.name ?? existing?.name ?? null,
    role: input.candidate.role ?? existing?.role ?? null,
    company: input.candidate.company ?? existing?.company ?? null,
    email: input.candidate.email ?? existing?.email ?? null,
    phone: input.candidate.phone ?? existing?.phone ?? null,
    website: input.candidate.website ?? existing?.website ?? null,
    linkedinUrl: input.candidate.linkedinUrl ?? existing?.linkedin_url ?? null,
    sourceType: input.sourceType,
    entityMatchConfidence: input.entityMatchConfidence ?? existing?.entity_match_confidence ?? 0.5,
    createdAt: existing?.created_at ?? timestamp,
    updatedAt: timestamp,
  });
}

export async function saveAtomsSupabase(
  userId: Id,
  conversationId: Id,
  atoms: ConversationAtoms,
  id: Id,
  createdAt: string,
): Promise<StoredConversationAtoms> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("conversation_atoms")
    .upsert({
      id,
      user_id: userId,
      conversation_id: conversationId,
      facts: atoms.facts,
      asks: atoms.asks,
      offers: atoms.offers,
      commitments: atoms.commitments,
      uncertainties: atoms.uncertainties,
      sentiment: atoms.sentiment ?? null,
      extraction_confidence: atoms.extractionConfidence,
      created_at: createdAt,
    })
    .select("*")
    .single<ConversationAtomsRow>();
  if (error) throw error;
  return atomsFromRow(data);
}

export async function listSourceRecordsSupabase(contactId: Id): Promise<SourceRecord[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("source_records")
    .select("*")
    .eq("contact_id", contactId)
    .order("retrieved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SourceRecordRow[]).map(sourceRecordFromRow);
}

export async function saveSourceRecordSupabase(
  record: SourceRecord,
  userId: Id,
): Promise<SourceRecord> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("source_records")
    .upsert(sourceRecordToRow(record, userId))
    .select("*")
    .single<SourceRecordRow>();
  if (error) throw error;
  return sourceRecordFromRow(data);
}

export async function listPublicContextSupabase(contactId: Id): Promise<PublicEntityContext[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("public_entity_context")
    .select("*")
    .eq("contact_id", contactId)
    .order("retrieved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PublicEntityContextRow[]).map(publicContextFromRow);
}

export async function savePublicContextSupabase(
  context: PublicEntityContext,
  userId: Id,
): Promise<PublicEntityContext> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("public_entity_context")
    .upsert(publicContextToRow(context, userId))
    .select("*")
    .single<PublicEntityContextRow>();
  if (error) throw error;
  return publicContextFromRow(data);
}

export async function listEvidenceFactsSupabase(contactId: Id): Promise<EvidenceFact[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("evidence_facts")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as EvidenceFactRow[]).map(evidenceFactFromRow);
}

export async function saveEvidenceFactSupabase(
  fact: EvidenceFact,
  userId: Id,
): Promise<EvidenceFact> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("evidence_facts")
    .upsert(evidenceFactToRow(fact, userId))
    .select("*")
    .single<EvidenceFactRow>();
  if (error) throw error;
  return evidenceFactFromRow(data);
}

export async function saveExtractionHandoffSupabase(
  handoff: ExtractionHandoff,
): Promise<ExtractionHandoff> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("extraction_handoffs")
    .upsert({
      request_id: handoff.requestId,
      user_id: handoff.userId,
      payload: handoff,
    })
    .select("*")
    .single<ExtractionHandoffRow>();
  if (error) throw error;
  return data.payload;
}

export async function saveEvidenceBundleSupabase(bundle: EvidenceBundle): Promise<EvidenceBundle> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("evidence_bundles")
    .upsert({
      id: `bundle_${bundle.requestId}`,
      user_id: bundle.userId,
      contact_id: bundle.contactId ?? null,
      conversation_id: bundle.conversationId,
      request_id: bundle.requestId,
      payload: bundle,
    })
    .select("*")
    .single<EvidenceBundleRow>();
  if (error) throw error;
  return data.payload;
}

export async function saveOpportunityRoutesSupabase(
  routes: OpportunityRoute[],
  userId: Id,
): Promise<OpportunityRoute[]> {
  if (!routes.length) return routes;
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("opportunity_routes")
    .upsert(routes.map((route) => opportunityRouteToRow(route, userId)))
    .select("*");
  if (error) throw error;
  return ((data ?? []) as OpportunityRouteRow[]).map(opportunityRouteFromRow);
}

export async function saveDraftSupabase(draft: Draft, userId: Id): Promise<Draft> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("drafts")
    .upsert(draftToRow(draft, userId))
    .select("*")
    .single<DraftRow>();
  if (error) throw error;
  return draftFromRow(data);
}

export async function getActiveObjectiveSupabase(userId: Id): Promise<UserObjectiveProfile | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("user_objectives")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ObjectiveRow>();
  if (error) throw error;
  return data ? objectiveFromRow(data) : null;
}

export async function saveUserObjectiveSupabase(
  input: UserObjectiveProfileInput & { id?: Id },
): Promise<UserObjectiveProfile> {
  const supabase = await requireClient();
  const row = objectiveToRow(input);
  const { data, error } = await supabase
    .from("user_objectives")
    .upsert(row)
    .select("*")
    .single<ObjectiveRow>();
  if (error) throw error;
  return objectiveFromRow(data);
}

export async function getContactSupabase(contactId: Id): Promise<Contact | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle<ContactRow>();
  if (error) throw error;
  return data ? contactFromRow(data) : null;
}

export async function listContactsSupabase(userId: Id): Promise<Contact[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ContactRow[]).map(contactFromRow);
}

export async function listRecommendationsSupabase(userId: Id): Promise<ActionRecommendation[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("action_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RecommendationRow[]).map(recommendationFromRow);
}

export async function getRecommendationSupabase(id: Id): Promise<ActionRecommendation | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("action_recommendations")
    .select("*")
    .eq("id", id)
    .maybeSingle<RecommendationRow>();
  if (error) throw error;
  return data ? recommendationFromRow(data) : null;
}

export async function getRecommendationForContactSupabase(contactId: Id): Promise<ActionRecommendation | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("action_recommendations")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecommendationRow>();
  if (error) throw error;
  return data ? recommendationFromRow(data) : null;
}

export async function saveRecommendationSupabase(rec: ActionRecommendation): Promise<ActionRecommendation> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("action_recommendations")
    .upsert(recommendationToRow(rec))
    .select("*")
    .single<RecommendationRow>();
  if (error) throw error;
  return recommendationFromRow(data);
}

export async function listOutcomesSupabase(userId: Id): Promise<Outcome[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("outcomes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OutcomeRow[]).map(outcomeFromRow);
}

export async function saveOutcomeSupabase(outcome: Outcome): Promise<Outcome> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("outcomes")
    .upsert(outcomeToRow(outcome))
    .select("*")
    .single<OutcomeRow>();
  if (error) throw error;
  return outcomeFromRow(data);
}

export async function getDraftForRecommendationSupabase(recommendationId: Id): Promise<Draft | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("recommendation_id", recommendationId)
    .maybeSingle<DraftRow>();
  if (error) throw error;
  return data ? draftFromRow(data) : null;
}
