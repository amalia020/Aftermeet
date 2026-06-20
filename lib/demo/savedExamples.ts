/**
 * Saved provider-level examples (Phase 25). These are the raw responses each
 * provider returns in demo mode, so the whole pipeline runs with zero API keys.
 * Fixture names are prefixed by workstream per the ownership map.
 *
 * Canonical demo narrative: "Maya from Recursive just closed Series A..."
 */

import type {
  CalaEntityCandidate,
  ConversationAtomsExtractionResult,
  UserObjectiveProfile,
  WebContextResult,
} from "@/lib/types";

export const DEMO_NOW = "2026-06-20T10:30:00.000Z";

export const part1DemoRawText =
  "Maya from Recursive just closed Series A, scaling the team fast, doing the European conference circuit. She liked AfterMeet and said she wants to try it at her next event.";

export const part1DemoTranscript = part1DemoRawText;

/** The active user objective for the demo: a founder looking for users. */
export const part1DemoObjective: UserObjectiveProfile = {
  id: "obj_demo",
  userId: "user_demo",
  role: "founder",
  primaryGoal: "find_users",
  secondaryGoals: ["find_design_partners", "collect_wtp"],
  activeGoals: ["find_users", "find_design_partners", "collect_wtp"],
  eventContext: "MEGATHON",
  companyName: "AfterMeet",
  companyStage: "pre-seed",
  productDescription:
    "Goal-conditioned relationship intelligence for high-density networking events.",
  targetCustomer: "Founders and operators who attend many events per year.",
  currentTraction: "Early access waitlist; first design partners.",
  fundraisingStatus: "Not actively raising.",
  hiringNeeds: [],
  attentionBudgetToday: 5,
  preferredTone: "warm",
  constraints: ["Do not send investor decks", "No pushy outreach"],
  createdAt: "2026-06-20T09:00:00.000Z",
  updatedAt: "2026-06-20T09:00:00.000Z",
};

/** Saved Claude extraction response (Part 1). */
export const part1DemoExtraction: ConversationAtomsExtractionResult = {
  contactCandidate: {
    name: "Maya",
    role: "Founder / CEO",
    company: "Recursive",
    email: null,
    phone: null,
    website: null,
    linkedinUrl: null,
  },
  atoms: {
    facts: [
      {
        text: "Recursive recently closed a Series A round.",
        type: "company_funding",
        confidence: 0.7,
        isProfessional: true,
        isSensitive: false,
      },
      {
        text: "Maya is scaling her team quickly.",
        type: "company_growth",
        confidence: 0.65,
        isProfessional: true,
        isSensitive: false,
      },
      {
        text: "Maya is doing the European conference circuit.",
        type: "behavior",
        confidence: 0.6,
        isProfessional: true,
        isSensitive: false,
      },
    ],
    asks: [],
    offers: [
      {
        text: "Maya wants to try AfterMeet at her next event.",
        mutualValue: 0.8,
      },
    ],
    commitments: [
      {
        text: "Maya expressed intent to try the product at her next event.",
        owner: "contact",
        dueAt: null,
        explicitness: 0.7,
      },
    ],
    uncertainties: [
      "Maya's last name was not captured.",
      "No contact details (email/LinkedIn) were exchanged.",
    ],
    sentiment: "positive",
    extractionConfidence: 0.72,
  },
  opportunityHints: [
    {
      route: "user",
      score: 0.82,
      evidence: [
        "Explicit product interest",
        "Attends many events (high ICP fit)",
      ],
    },
    {
      route: "partner",
      score: 0.35,
      evidence: ["Founder peer, possible cross-promotion"],
    },
  ],
};

/** Saved Cala candidates + answer (Part 2). */
export const part2DemoCalaCandidates: CalaEntityCandidate[] = [
  {
    providerEntityId: "cala_recursive",
    name: "Recursive",
    entityType: "company",
    company: "Recursive",
    role: undefined,
    domain: "recursive.ai",
    confidence: 0.78,
  },
];

export const part2DemoCalaAnswer =
  "Recursive is an applied-AI company building developer tooling. Public signals indicate a recently announced Series A financing round and active hiring across engineering.";

export const part2DemoCalaFacts = [
  "Recursive operates in the applied-AI / developer-tooling sector.",
  "Recursive announced a Series A financing round.",
  "Recursive is actively hiring across engineering.",
];

/** Saved Gemini grounded web response (Part 2 fallback). */
export const part2DemoWebResult: WebContextResult = {
  summary:
    "Recursive is an applied-AI startup. Recent coverage references a Series A raise and European go-to-market activity.",
  claims: [
    {
      text: "Recursive announced a Series A round.",
      sourceUrl: "https://example-press.com/recursive-series-a",
      sourceType: "reputable_news",
    },
    {
      text: "Recursive is expanding its presence across European tech events.",
      sourceUrl: "https://recursive.ai/blog/europe",
      sourceType: "company_website",
    },
  ],
  retrievedAt: DEMO_NOW,
  available: true,
};

/** Saved Claude draft body (Part 3), used when the draft LLM hop falls back. */
export const part3DemoDraft = {
  channel: "email" as const,
  tone: "warm",
  subject: "Great meeting you at MEGATHON",
  body: "Hi Maya,\n\nReally enjoyed our chat at MEGATHON — congrats again on the Series A and the team scaling.\n\nSince you mentioned wanting to try AfterMeet at your next event, I'd love to get you early access so it's ready before your next stop on the circuit. Want me to set that up?\n\nNo rush at all — happy to time it around your schedule.\n\nBest,\nDemo Founder",
  facts_used: [
    "Recursive recently closed a Series A round.",
    "Maya wants to try AfterMeet at her next event.",
  ],
  risk_note: null as string | null,
};
