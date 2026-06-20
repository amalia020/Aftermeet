import type {
  CaptureScreenViewModel,
  FollowUpBoardViewModel,
  OpportunityTerminalViewModel,
  PersonViewModel,
  TractionViewModel,
} from "@/lib/types";

const now = "2026-06-20T09:00:00.000Z";

export const objective = {
  id: "obj_recruit_core_talent",
  userId: "user_demo",
  role: "founder",
  activeGoals: ["hire", "source_candidates"],
  primaryGoal: "hire",
  secondaryGoals: ["find_partners"],
  eventContext: "TechInfra Summit",
  companyName: "Aftermeet",
  companyStage: "pre-seed",
  productDescription: "Relationship intelligence for high-density networking.",
  targetCustomer: "Founders, recruiters, operators, investors, and BD leads.",
  currentTraction: "24 high-potential candidates engaged this quarter.",
  hiringNeeds: ["Senior infra candidates", "Distributed systems operators"],
  attentionBudgetToday: 3,
  preferredTone: "warm",
  constraints: [
    "Do not pitch formal roles before technical trust exists.",
    "Avoid broad follow-up blasts.",
  ],
  createdAt: now,
  updatedAt: now,
} satisfies OpportunityTerminalViewModel["activeObjective"];

export interface BriefMove {
  id: string;
  name: string;
  role: string;
  initials: string;
  signal: "follow" | "hold" | "network";
  label: string;
  action: string;
  reason: string;
  href?: string;
}

export interface DailyBriefViewModel {
  activeObjective: typeof objective;
  headline: string;
  moves: BriefMove[];
  cooling: BriefMove;
  missionGap: string;
  proof: {
    label: string;
    value: string;
    note: string;
  }[];
}

export const dailyBrief: DailyBriefViewModel = {
  activeObjective: objective,
  headline: "3 moves can advance Recruit Core Talent",
  moves: [
    {
      id: "elena",
      name: "Elena Rostova",
      role: "Lead AI Systems Architect",
      initials: "ER",
      signal: "follow",
      label: "Follow today",
      action: "Send technical follow-up",
      reason: "Context is warm and the technical opening is clear.",
      href: "/contacts/elena",
    },
    {
      id: "marcus",
      name: "Marcus Chen",
      role: "Partner at Vertex",
      initials: "MC",
      signal: "hold",
      label: "Hold",
      action: "Wait for his term sheet feedback",
      reason: "Recipient burden is high until he replies.",
    },
    {
      id: "sarah",
      name: "Sarah Jenkins",
      role: "VP Engineering",
      initials: "SJ",
      signal: "network",
      label: "Intro path",
      action: "Ask for intro to platform lead",
      reason: "Her team sits beside the hiring gap.",
    },
  ],
  cooling: {
    id: "david",
    name: "David Chen",
    role: "Product Lead",
    initials: "DC",
    signal: "follow",
    label: "Cooling",
    action: "Re-engage with a concrete prompt",
    reason: "Warmth is fading after four quiet days.",
  },
  missionGap: "Still missing senior infra candidates with scaling experience.",
  proof: [
    { label: "Today", value: "3", note: "high-leverage moves" },
    { label: "Warm", value: "7", note: "relationships in motion" },
    { label: "Blocked", value: "2", note: "waiting on replies" },
  ],
};

export interface RadarNode {
  id: string;
  name: string;
  initials: string;
  x: number;
  y: number;
  state: "action" | "warm" | "waiting" | "cooling" | "gap";
  note: string;
}

export interface MissionRadarViewModel {
  objective: typeof objective;
  nodes: RadarNode[];
  bridges: { from: string; to: string; label: string }[];
}

export const missionRadar: MissionRadarViewModel = {
  objective,
  nodes: [
    { id: "elena", name: "Elena", initials: "ER", x: 78, y: 78, state: "action", note: "Best move today" },
    { id: "sarah", name: "Sarah", initials: "SJ", x: 70, y: 48, state: "warm", note: "Intro opportunity" },
    { id: "david", name: "David", initials: "DC", x: 36, y: 68, state: "cooling", note: "Warmth fading" },
    { id: "marcus", name: "Marcus", initials: "MC", x: 32, y: 31, state: "waiting", note: "Hold" },
    { id: "gap", name: "Infra gap", initials: "IG", x: 58, y: 20, state: "gap", note: "Missing coverage" },
  ],
  bridges: [
    { from: "sarah", to: "gap", label: "platform lead" },
    { from: "elena", to: "gap", label: "technical trust" },
  ],
};

export const captureScreen: CaptureScreenViewModel = {
  activeObjective: objective,
  acceptableUseText:
    "Capture your own meeting notes only. Aftermeet will keep the final recommendation user-controlled.",
  supportedCaptureTypes: ["text", "voice", "card"],
  state: "ready",
};

export interface PersonIntelligenceViewModel extends PersonViewModel {
  contact: {
    name: string;
    role: string;
    company: string;
    initials: string;
    location: string;
  };
  warmth: "High" | "Medium" | "Cooling";
  missionFit: "Strong" | "Promising" | "Weak";
  systemNote: string;
  recommendation: {
    title: string;
    reason: string;
    avoid: string;
    draft: string;
  };
}

export const personIntelligence: PersonIntelligenceViewModel = {
  contactId: "contact_elena",
  state: "ready",
  contact: {
    name: "Elena Rostova",
    role: "Lead AI Systems Architect",
    company: "Quantum Dynamics",
    initials: "ER",
    location: "San Francisco, CA",
  },
  warmth: "High",
  missionFit: "Strong",
  systemNote: "Context is fresh. You met 2 days ago at TechInfra Summit.",
  recommendation: {
    title: "Best move today: send technical follow-up",
    reason:
      "She matches the senior infra hiring gap, the conversation is still warm, and there is a clear technical opening.",
    avoid:
      "Do not pitch a formal role yet. Start with technical dialogue to build trust before discussing openings.",
    draft:
      "Hi Elena,\n\nGreat discussing the nuances of distributed inference scaling with you. I pulled together a few notes on that bottleneck we touched on, especially around latency under production load.\n\nWould be glad to compare notes this week if useful.",
  },
};

export interface BoardSection {
  id: string;
  title: string;
  context: string;
  tone: "urgent" | "warm" | "waiting" | "cooling" | "dormant";
  cards: {
    id: string;
    name: string;
    role: string;
    label: string;
    note: string;
    action: string;
    disabled?: boolean;
  }[];
}

export interface RelationshipBoardViewModel extends FollowUpBoardViewModel {
  sections: BoardSection[];
}

export const relationshipBoard: RelationshipBoardViewModel = {
  state: "ready",
  columns: [],
  sections: [
    {
      id: "needs-action",
      title: "Needs Action",
      context: "High priority",
      tone: "urgent",
      cards: [
        {
          id: "sarah",
          name: "Sarah Jenkins",
          role: "VP Eng at TechCorp",
          label: "Follow up today",
          note: "Requested technical brief regarding scale architecture.",
          action: "Draft ready",
        },
        {
          id: "marcus",
          name: "Marcus Chen",
          role: "Partner at Vertex",
          label: "Follow up today",
          note: "Awaiting term sheet feedback before EOD.",
          action: "Draft ready",
        },
      ],
    },
    {
      id: "warm",
      title: "Warm",
      context: "Active context",
      tone: "warm",
      cards: [
        {
          id: "elena",
          name: "Elena Rostova",
          role: "Founder at Synthetix",
          label: "Intro opportunity",
          note: "Recent shared panel discussion created strong mutual alignment.",
          action: "Intro draft",
        },
      ],
    },
    {
      id: "waiting",
      title: "Waiting",
      context: "External dependency",
      tone: "waiting",
      cards: [
        {
          id: "david",
          name: "David Kim",
          role: "Director at Nexus",
          label: "Wait",
          note: "He is reviewing budget proposals until next Tuesday.",
          action: "Draft locked",
          disabled: true,
        },
      ],
    },
    {
      id: "cooling",
      title: "Cooling",
      context: "Risk of fade",
      tone: "cooling",
      cards: [
        {
          id: "aisha",
          name: "Aisha Patel",
          role: "Lead Design at Orbit",
          label: "Re-engage",
          note: "Context is fading after the initial coffee chat last month.",
          action: "Article draft",
        },
      ],
    },
    {
      id: "dormant",
      title: "Dormant",
      context: "No critical revivals",
      tone: "dormant",
      cards: [],
    },
  ],
};

export interface OutcomeLoopViewModel extends TractionViewModel {
  contact: PersonIntelligenceViewModel["contact"];
  prompt: string;
  options: {
    id: string;
    label: string;
    kind: "positive" | "neutral" | "negative";
  }[];
}

export const outcomeLoop: OutcomeLoopViewModel = {
  state: "ready",
  summary: {
    followUpsSent: 18,
    repliesReceived: 11,
    bookedMeetings: 5,
    wtpSignals: 2,
    paidCommits: 0,
    replyRateByOpportunityType: { candidate: 0.61, partner: 0.44 },
    actionsCompleted: 27,
    contactsArchivedOrIgnored: 9,
  },
  contact: personIntelligence.contact,
  prompt: "How did the move with Elena go?",
  options: [
    { id: "reply", label: "Replied", kind: "positive" },
    { id: "booked", label: "Meeting booked", kind: "positive" },
    { id: "intro", label: "Intro made", kind: "positive" },
    { id: "converted", label: "Hired / converted", kind: "positive" },
    { id: "not-relevant", label: "Not relevant", kind: "negative" },
    { id: "no-response", label: "No response", kind: "neutral" },
  ],
};
