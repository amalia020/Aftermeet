import type {
  CalaEntityCandidate,
  CalaEntityDetail,
  ContactCandidate,
  ConversationAtomsExtractionResult,
  ExtractionProviderResult,
  User,
  UserObjectiveProfile,
  WebContextResult
} from "@/lib/types";

export const DEMO_USER_ID = "user_demo_aftermeet";
export const DEMO_OBJECTIVE_ID = "obj_demo_megathon";
export const DEMO_REQUEST_ID = "req_demo_maya_recursive";
export const DEMO_CONVERSATION_ID = "conv_demo_maya_recursive";
export const DEMO_CONTACT_ID = "contact_demo_maya_recursive";

export const demoUser: User = {
  id: DEMO_USER_ID,
  name: "AfterMeet Demo User",
  email: "demo@aftermeet.local",
  createdAt: "2026-06-20T10:00:00.000Z"
};

export const demoObjective: UserObjectiveProfile = {
  id: DEMO_OBJECTIVE_ID,
  userId: DEMO_USER_ID,
  role: "founder",
  activeGoals: ["find_users", "find_design_partners", "collect_wtp"],
  primaryGoal: "find_users",
  secondaryGoals: ["find_design_partners", "collect_wtp"],
  eventContext: "MEGATHON",
  companyName: "AfterMeet",
  companyStage: "prototype",
  productDescription:
    "A goal-conditioned relationship intelligence layer for high-density networking events.",
  targetCustomer: "Event-heavy founders, operators, and community builders",
  currentTraction: "Hackathon demo with fixture-backed evidence",
  fundraisingStatus: "not fundraising",
  hiringNeeds: [],
  attentionBudgetToday: 5,
  preferredTone: "warm",
  constraints: [
    "Do not auto-send messages",
    "Only enrich contacts the user actually met",
    "Prefer concise follow-up recommendations"
  ],
  createdAt: "2026-06-20T10:00:00.000Z",
  updatedAt: "2026-06-20T10:00:00.000Z"
};

export const demoConversationText =
  "Maya from Recursive just closed Series A, scaling the team fast, doing the European conference circuit. She liked AfterMeet and said she wants to try it at her next event.";

export const demoTranscript =
  "Met Maya from Recursive. They just closed Series A, are scaling the team fast, and are doing the European conference circuit. She liked AfterMeet and wants to try it at her next event.";

export const demoContactCandidate: ContactCandidate = {
  name: "Maya Linden",
  role: "Founder / operator",
  company: "Recursive",
  email: null,
  phone: null,
  website: "https://recursive.example",
  linkedinUrl: null
};

export const demoExtractionResult: ConversationAtomsExtractionResult = {
  contactCandidate: demoContactCandidate,
  atoms: {
    facts: [
      {
        text: "Maya is associated with Recursive.",
        type: "contact_company",
        confidence: 0.84,
        isProfessional: true,
        isSensitive: false
      },
      {
        text: "Recursive recently closed a Series A.",
        type: "funding",
        confidence: 0.74,
        isProfessional: true,
        isSensitive: false
      },
      {
        text: "Recursive is scaling its team quickly.",
        type: "growth",
        confidence: 0.72,
        isProfessional: true,
        isSensitive: false
      },
      {
        text: "Maya is active on the European conference circuit.",
        type: "event_activity",
        confidence: 0.72,
        isProfessional: true,
        isSensitive: false
      },
      {
        text: "Maya expressed interest in trying AfterMeet at her next event.",
        type: "product_interest",
        confidence: 0.9,
        isProfessional: true,
        isSensitive: false
      }
    ],
    asks: [
      {
        text: "Maya wants to try AfterMeet at her next event.",
        askSize: 0.34,
        explicitness: 0.82
      }
    ],
    offers: [
      {
        text: "AfterMeet can provide early access for Maya's next event.",
        mutualValue: 0.86
      }
    ],
    commitments: [
      {
        text: "Follow up with Maya about early access.",
        owner: "user",
        dueAt: null,
        explicitness: 0.78
      }
    ],
    uncertainties: [
      "Maya's last name was not provided in the note; fixture uses a demo surname.",
      "The exact date and source of the Series A should be verified before using it externally."
    ],
    sentiment: "warm interest",
    extractionConfidence: 0.82
  },
  opportunityHints: [
    {
      route: "user",
      score: 0.9,
      evidence: [
        "Explicit product interest",
        "Event-heavy profile",
        "Low recipient burden early access offer"
      ]
    },
    {
      route: "partner",
      score: 0.48,
      evidence: ["European conference circuit could create distribution relevance"]
    },
    {
      route: "hire",
      score: 0.22,
      evidence: ["Recursive is scaling its team, but no hiring ask was discussed"]
    }
  ]
};

export const demoExtractionProviderResult: ExtractionProviderResult = {
  provider: "fixture",
  model: "aftermeet-demo-extraction",
  extractionConfidence: demoExtractionResult.atoms.extractionConfidence,
  warnings: ["Demo fixture used because live Gemini extraction is unavailable or unnecessary."]
};

export const demoCalaCandidate: CalaEntityCandidate = {
  providerEntityId: "cala_demo_recursive",
  name: "Recursive",
  entityType: "company",
  company: "Recursive",
  role: "Company",
  domain: "recursive.example",
  confidence: 0.78
};

export const demoCalaDetail: CalaEntityDetail = {
  providerEntityId: demoCalaCandidate.providerEntityId,
  entityType: "company",
  canonicalName: "Recursive",
  rawContext: {
    summary: "Recursive is a demo company fixture used for AfterMeet evidence flows.",
    facts: [
      "Recursive is represented as a Series A company in the demo context.",
      "Recursive has event-heavy go-to-market signals in the demo context.",
      "Recursive is scaling its team in the demo context."
    ],
    sourceName: "Cala demo knowledge fixture"
  },
  retrievedAt: "2026-06-20T10:05:00.000Z"
};

export const demoWebContext: WebContextResult = {
  summary:
    "Public fixture context suggests Recursive is relevant to event-heavy professional workflows.",
  claims: [
    {
      text: "Recursive describes event participation as part of its growth motion.",
      sourceUrl: "https://recursive.example/events",
      sourceType: "company_website"
    },
    {
      text: "Recursive announced a Series A financing in the fixture press item.",
      sourceUrl: "https://recursive.example/news/series-a",
      sourceType: "official_press"
    },
    {
      text: "Recursive is hiring across product and go-to-market roles in the fixture context.",
      sourceUrl: "https://recursive.example/careers",
      sourceType: "company_website"
    }
  ],
  retrievedAt: "2026-06-20T10:06:00.000Z",
  available: true
};

export function isDemoMayaConversation(rawText: string): boolean {
  const normalized = rawText.toLowerCase();
  return normalized.includes("maya") && normalized.includes("recursive");
}
