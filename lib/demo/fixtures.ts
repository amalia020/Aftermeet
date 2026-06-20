/**
 * Assembled demo fixtures (Phase 25). Builds the full handoff chain
 * (ExtractionHandoff -> EvidenceBundle -> RecommendationPackage) plus the
 * FrontendMockDataset that Part 4 renders without importing any backend logic.
 *
 * These are hand-authored so the demo is bulletproof even if every live
 * provider is down. The shapes match lib/types exactly.
 */

import type {
  CalaEntityCandidate,
  CalaEntityDetail,
  ContactCandidate,
  EvidenceBundle,
  ExtractionProviderResult,
  ExtractionHandoff,
  FrontendMockDataset,
  ProcessStageEvent,
  RecommendationPackage,
  User,
  UserObjectiveProfile,
  WebContextResult,
} from "@/lib/types";
import type { Conversation } from "@/lib/types";
import {
  DEMO_NOW,
  part1DemoExtraction,
  part1DemoObjective,
  part1DemoRawText,
  part1DemoTranscript,
  part2DemoCalaCandidates,
  part2DemoCalaFacts,
  part2DemoWebResult,
  part3DemoDraft,
} from "./savedExamples";

const REQUEST_ID = "req_demo";
const CONVERSATION_ID = "conv_demo";
const CONTACT_ID = "contact_demo";
const RECOMMENDATION_ID = "rec_demo";

export const DEMO_USER_ID = "user_demo";
export const DEMO_OBJECTIVE_ID = part1DemoObjective.id;
export const DEMO_REQUEST_ID = REQUEST_ID;
export const DEMO_CONVERSATION_ID = CONVERSATION_ID;
export const DEMO_CONTACT_ID = CONTACT_ID;

export const demoUser: User = {
  id: DEMO_USER_ID,
  name: "Demo Founder",
  email: "demo@aftermeet.app",
  createdAt: "2026-06-20T09:00:00.000Z",
};

export const demoObjective: UserObjectiveProfile = part1DemoObjective;
export const demoConversationText = part1DemoRawText;
export const demoTranscript = part1DemoTranscript;
export const demoContactCandidate: ContactCandidate =
  part1DemoExtraction.contactCandidate;
export const demoExtractionResult = part1DemoExtraction;
export const demoExtractionProviderResult: ExtractionProviderResult = {
  provider: "fixture",
  model: "aftermeet-demo-extraction",
  extractionConfidence: part1DemoExtraction.atoms.extractionConfidence,
  warnings: ["Demo fixture used because live Gemini extraction is unavailable."],
};

export const demoCalaCandidate: CalaEntityCandidate = part2DemoCalaCandidates[0];
export const demoCalaDetail: CalaEntityDetail = {
  providerEntityId: demoCalaCandidate.providerEntityId,
  entityType: demoCalaCandidate.entityType,
  canonicalName: demoCalaCandidate.company ?? demoCalaCandidate.name,
  rawContext: {
    facts: part2DemoCalaFacts,
    summary: "Recursive demo knowledge fixture.",
  },
  retrievedAt: DEMO_NOW,
};
export const demoWebContext: WebContextResult = part2DemoWebResult;

export function isDemoMayaConversation(rawText: string): boolean {
  const normalized = rawText.toLowerCase();
  return normalized.includes("maya") && normalized.includes("recursive");
}

export const part1DemoConversation: Conversation = {
  id: CONVERSATION_ID,
  userId: "user_demo",
  contactId: CONTACT_ID,
  rawText: part1DemoRawText,
  captureType: "text",
  transcript: null,
  eventContext: "MEGATHON",
  capturedAt: DEMO_NOW,
  processingStatus: "extracted",
};

export const part1DemoHandoff: ExtractionHandoff = {
  requestId: REQUEST_ID,
  userId: "user_demo",
  objective: part1DemoObjective,
  conversation: part1DemoConversation,
  contactCandidate: part1DemoExtraction.contactCandidate,
  atoms: part1DemoExtraction.atoms,
  opportunityHints: part1DemoExtraction.opportunityHints,
  extraction: {
    provider: "fixture",
    model: "demo",
    extractionConfidence: part1DemoExtraction.atoms.extractionConfidence,
    warnings: [],
  },
  sourceRecord: {
    provider: "conversation",
    sourceType: "user_voice_note",
    retrievedAt: DEMO_NOW,
    sourceConfidence: 0.72,
  },
};

export const part2DemoEvidenceBundle: EvidenceBundle = {
  requestId: REQUEST_ID,
  userId: "user_demo",
  conversationId: CONVERSATION_ID,
  contactId: CONTACT_ID,
  contactCandidate: part1DemoExtraction.contactCandidate,
  publicContext: [
    {
      id: "ctx_demo_cala",
      contactId: CONTACT_ID,
      provider: "cala",
      providerEntityId: "cala_recursive",
      entityType: "company",
      canonicalName: "Recursive",
      rawContext: {
        sector: "applied-ai",
        funding: "Series A",
      },
      retrievedAt: DEMO_NOW,
      confidence: 0.78,
    },
  ],
  sourceRecords: [
    {
      id: "src_demo_voice",
      contactId: CONTACT_ID,
      provider: "conversation",
      sourceType: "user_voice_note",
      sourceName: "Captured conversation",
      sourceUrl: null,
      retrievedAt: DEMO_NOW,
      sourceConfidence: 0.72,
    },
    {
      id: "src_demo_cala",
      contactId: CONTACT_ID,
      provider: "cala",
      sourceType: "cala_verified_fact",
      sourceName: "Cala verified company context",
      sourceUrl: null,
      retrievedAt: DEMO_NOW,
      sourceConfidence: 0.82,
    },
    {
      id: "src_demo_web",
      contactId: CONTACT_ID,
      provider: "web",
      sourceType: "reputable_news",
      sourceName: "Press coverage",
      sourceUrl: part2DemoWebResult.claims[0]?.sourceUrl ?? null,
      retrievedAt: DEMO_NOW,
      sourceConfidence: 0.8,
    },
  ],
  evidenceFacts: [
    {
      id: "fact_demo_interest",
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      fact: "Maya wants to try AfterMeet at her next event.",
      factType: "intent",
      sourceRecordId: "src_demo_voice",
      sourceType: "user_voice_note",
      entityMatchConfidence: 0.9,
      sourceConfidence: 0.72,
      extractionConfidence: 0.72,
      freshness: 1,
      contradictionPenalty: 0,
      factConfidence: 0.82,
      safeForDraft: true,
      isProfessional: true,
      isSensitive: false,
      createdAt: DEMO_NOW,
    },
    {
      id: "fact_demo_seriesa",
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      fact: "Recursive recently closed a Series A round.",
      factType: "company_funding",
      sourceRecordId: "src_demo_cala",
      sourceType: "cala_verified_fact",
      entityMatchConfidence: 0.78,
      sourceConfidence: 0.82,
      extractionConfidence: 0.85,
      freshness: 1,
      contradictionPenalty: 0,
      factConfidence: 0.78,
      safeForDraft: true,
      isProfessional: true,
      isSensitive: false,
      createdAt: DEMO_NOW,
    },
    {
      id: "fact_demo_circuit",
      contactId: CONTACT_ID,
      conversationId: CONVERSATION_ID,
      fact: "Recursive is expanding across European tech events.",
      factType: "behavior",
      sourceRecordId: "src_demo_web",
      sourceType: "reputable_news",
      entityMatchConfidence: 0.6,
      sourceConfidence: 0.8,
      extractionConfidence: 0.6,
      freshness: 1,
      contradictionPenalty: 0,
      factConfidence: 0.55,
      safeForDraft: false,
      isProfessional: true,
      isSensitive: false,
      createdAt: DEMO_NOW,
    },
  ],
  entityResolution: {
    capturedName: "Maya",
    capturedCompany: "Recursive",
    capturedRole: "Founder / CEO",
    candidateName: "Recursive",
    candidateCompany: "Recursive",
    candidateDomain: "recursive.ai",
    score: 0.74,
    label: "medium",
    needsUserConfirmation: false,
    reasons: [
      "Company name matches a verified Cala entity.",
      "Person last name not captured; company-level match only.",
    ],
  },
  enrichment: {
    attempted: true,
    calaAttempted: true,
    webFallbackAttempted: true,
    status: "available",
    warnings: [],
  },
};

const demoRoutes: RecommendationPackage["routes"] = [
  {
    id: "route_demo_user",
    contactId: CONTACT_ID,
    conversationId: CONVERSATION_ID,
    type: "user",
    score: 0.86,
    evidence: [
      "Explicit product interest",
      "Event-heavy founder/operator profile (high ICP fit)",
      "Warm, fresh conversation",
    ],
    why: [
      "Explicit product interest",
      "High ICP fit",
      "Low recipient burden",
      "Warm conversation still fresh",
    ],
    whyNot: [],
  },
  {
    id: "route_demo_partner",
    contactId: CONTACT_ID,
    conversationId: CONVERSATION_ID,
    type: "partner",
    score: 0.38,
    evidence: ["Founder peer"],
    why: ["Possible cross-promotion later"],
    whyNot: ["No concrete partner pilot discussed, so do not pitch partnership yet"],
  },
  {
    id: "route_demo_raise",
    contactId: CONTACT_ID,
    conversationId: CONVERSATION_ID,
    type: "raise",
    score: 0.08,
    evidence: [],
    why: [],
    whyNot: ["Not an investor conversation, so do not send a deck"],
  },
];

export const part3DemoRecommendationPackage: RecommendationPackage = {
  recommendation: {
    id: RECOMMENDATION_ID,
    userId: "user_demo",
    contactId: CONTACT_ID,
    conversationId: CONVERSATION_ID,
    recommendedAction: "SEND_EARLY_ACCESS",
    priorityScore: 0.84,
    urgencyScore: 0.55,
    recipientBurden: 0.22,
    confidence: 0.8,
    status: "pending",
    explanation: {
      inputSummary:
        "Met Maya (Recursive) at MEGATHON. Series A, scaling, event circuit, wants to try AfterMeet.",
      extractedFacts: [
        "Maya wants to try AfterMeet at her next event.",
        "Recursive recently closed a Series A round.",
        "Maya is doing the European conference circuit.",
      ],
      retrievedContext: [
        "Cala: Recursive is an applied-AI company; Series A confirmed.",
        "Web: European go-to-market activity.",
      ],
      routeScores: demoRoutes,
      chosenRoute: demoRoutes[0],
      chosenAction: "SEND_EARLY_ACCESS",
      whyThisAction: [
        "Explicit product interest",
        "High ICP fit",
        "Event-heavy founder/operator profile",
        "Low recipient burden",
        "Warm conversation still fresh",
      ],
      whyNotOtherActions: [
        "Not an investor conversation, so do not send deck",
        "No concrete partner pilot discussed, so do not pitch partnership yet",
        "No mentor ask needed yet",
      ],
      confidenceBreakdown: {
        entityMatch: 0.74,
        sourceConfidence: 0.78,
        factConfidence: 0.8,
        userGoalFit: 0.9,
        contactPovFit: 0.85,
        recipientBurden: 0.22,
        finalConfidence: 0.8,
      },
      safeFactsUsed: [
        "Maya wants to try AfterMeet at her next event.",
        "Recursive recently closed a Series A round.",
      ],
      warnings: [],
    },
    createdAt: DEMO_NOW,
  },
  routes: demoRoutes,
  decisionTrace: {
    inputSummary:
      "Met Maya (Recursive) at MEGATHON. Series A, scaling, event circuit, wants to try AfterMeet.",
    extractedFacts: [
      "Maya wants to try AfterMeet at her next event.",
      "Recursive recently closed a Series A round.",
      "Maya is doing the European conference circuit.",
    ],
    retrievedContext: [
      "Cala: Recursive is an applied-AI company; Series A confirmed.",
      "Web: European go-to-market activity.",
    ],
    routeScores: demoRoutes,
    chosenRoute: demoRoutes[0],
    chosenAction: "SEND_EARLY_ACCESS",
    whyThisAction: [
      "Explicit product interest",
      "High ICP fit",
      "Event-heavy founder/operator profile",
      "Low recipient burden",
      "Warm conversation still fresh",
    ],
    whyNotOtherActions: [
      "Not an investor conversation, so do not send deck",
      "No concrete partner pilot discussed, so do not pitch partnership yet",
      "No mentor ask needed yet",
    ],
    confidenceBreakdown: {
      entityMatch: 0.74,
      sourceConfidence: 0.78,
      factConfidence: 0.8,
      userGoalFit: 0.9,
      contactPovFit: 0.85,
      recipientBurden: 0.22,
      finalConfidence: 0.8,
    },
    safeFactsUsed: [
      "Maya wants to try AfterMeet at her next event.",
      "Recursive recently closed a Series A round.",
    ],
    warnings: [],
  },
  draft: {
    id: "draft_demo",
    recommendationId: RECOMMENDATION_ID,
    contactId: CONTACT_ID,
    channel: part3DemoDraft.channel,
    tone: part3DemoDraft.tone,
    subject: part3DemoDraft.subject,
    body: part3DemoDraft.body,
    factsUsed: part3DemoDraft.facts_used,
    status: "drafted",
    riskNote: part3DemoDraft.risk_note,
    createdAt: DEMO_NOW,
    sentAt: null,
  },
  boardCard: {
    contactId: CONTACT_ID,
    recommendationId: RECOMMENDATION_ID,
    contactName: "Maya",
    company: "Recursive",
    status: "new",
    recommendedAction: "SEND_EARLY_ACCESS",
    priorityScore: 0.84,
    urgencyScore: 0.55,
    warmthScore: 0.78,
    warning: false,
    updatedAt: DEMO_NOW,
  },
  warnings: [],
};

export const demoProcessingEvents: ProcessStageEvent[] = [
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "capturing", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "extracting", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "persisting_atoms", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "resolving_entity", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "retrieving_context", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "scoring_routes", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "choosing_action", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "generating_draft", status: "completed", timestamp: DEMO_NOW },
  { requestId: REQUEST_ID, conversationId: CONVERSATION_ID, stage: "handoff_ready", status: "completed", timestamp: DEMO_NOW },
];

export const frontendMockDataset: FrontendMockDataset = {
  objective: part1DemoObjective,
  extractionHandoff: part1DemoHandoff,
  evidenceBundle: part2DemoEvidenceBundle,
  recommendationPackage: part3DemoRecommendationPackage,
  processingEvents: demoProcessingEvents,
};
