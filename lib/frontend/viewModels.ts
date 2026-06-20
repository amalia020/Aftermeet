/**
 * Pure view-model builders (Part 4).
 *
 * Each builder maps either the FrontendMockDataset (fixture mode) or a typed API
 * response into one of the *ViewModel shapes from lib/types/ui.ts. Components only
 * ever consume these view models, so the same component renders identically from
 * fixtures or live data.
 *
 * No imports from lib/intelligence, lib/providers, or lib/db.
 */

import type {
  ClusterRecommendation,
  ContactSummary,
  DecisionTraceViewModel,
  EvidenceBundle,
  FollowUpBoardCard,
  FollowUpBoardViewModel,
  FrontendMockDataset,
  MissionSetupViewModel,
  CaptureScreenViewModel,
  ContactListViewModel,
  OpportunityRoute,
  OpportunityTerminalViewModel,
  PersonViewModel,
  PipelineStageView,
  ProcessStage,
  ProcessStageEvent,
  ProcessingCascadeViewModel,
  RecommendationPackage,
  ScreenState,
  TractionSummary,
  TractionViewModel,
  UserObjectiveProfile,
} from "@/lib/types";

export const ACCEPTABLE_USE_TEXT =
  "Capture professional context from conversations you took part in. AfterMeet drafts follow-ups for you to review and send manually. Nothing is sent automatically.";

/** Ordered pipeline stages with human labels. Mirrors the process route order. */
export const PIPELINE_STAGE_ORDER: { id: ProcessStage; label: string; description: string }[] = [
  { id: "capturing", label: "Capture", description: "Reading the conversation" },
  { id: "transcribing", label: "Transcribe", description: "Turning audio into text" },
  { id: "extracting", label: "Extract", description: "Pulling out facts, asks, and offers" },
  { id: "persisting_atoms", label: "Save atoms", description: "Storing the conversation atoms" },
  { id: "resolving_entity", label: "Resolve identity", description: "Matching the person and company" },
  { id: "retrieving_context", label: "Retrieve context", description: "Finding verified public context" },
  { id: "scoring_routes", label: "Score routes", description: "Weighing every opportunity path" },
  { id: "choosing_action", label: "Choose action", description: "Picking the single best next move" },
  { id: "generating_draft", label: "Draft", description: "Writing a follow-up to review" },
  { id: "handoff_ready", label: "Ready", description: "Decision trace is ready" },
];

/** Stages that only appear conditionally (audio transcription) — hidden until seen. */
const CONDITIONAL_STAGES: ProcessStage[] = ["transcribing"];

function eventStatusToVisual(
  status: ProcessStageEvent["status"],
): PipelineStageView["status"] {
  switch (status) {
    case "started":
      return "active";
    case "completed":
      return "complete";
    case "fallback":
      return "fallback";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

/**
 * Fold a list of stage events into an ordered list of visual stages. Stages not
 * yet seen are "idle"; the most advanced status for a stage wins.
 */
export function buildCascadeStages(events: ProcessStageEvent[]): PipelineStageView[] {
  const seen = new Set<ProcessStage>();
  const latestByStage = new Map<ProcessStage, ProcessStageEvent>();
  for (const event of events) {
    seen.add(event.stage);
    latestByStage.set(event.stage, event);
  }

  const failed = events.some((e) => e.stage === "failed");

  return PIPELINE_STAGE_ORDER.filter(
    (stage) => !CONDITIONAL_STAGES.includes(stage.id) || seen.has(stage.id),
  ).map((stage) => {
    const event = latestByStage.get(stage.id);
    let status: PipelineStageView["status"] = event
      ? eventStatusToVisual(event.status)
      : "idle";
    if (failed && status === "idle") status = "blocked";
    return {
      id: stage.id,
      label: stage.label,
      description: stage.description,
      status,
      startedAt: event?.timestamp,
      completedAt:
        event && (event.status === "completed" || event.status === "fallback")
          ? event.timestamp
          : undefined,
      warning:
        event && (event.status === "fallback" || event.status === "failed")
          ? event.message
          : undefined,
    };
  });
}

export function buildProcessingCascadeViewModel(input: {
  requestId: string;
  conversationId?: string;
  events: ProcessStageEvent[];
  state?: ScreenState;
}): ProcessingCascadeViewModel {
  const stages = buildCascadeStages(input.events);
  const latestEvent = input.events[input.events.length - 1];
  const done = latestEvent?.stage === "handoff_ready" && latestEvent.status === "completed";
  const failed = input.events.some((e) => e.stage === "failed");
  const state: ScreenState =
    input.state ?? (failed ? "fallback" : done ? "ready" : input.events.length ? "loading" : "idle");
  return {
    requestId: input.requestId,
    conversationId: input.conversationId,
    stages,
    latestEvent,
    state,
  };
}

/** Build the decision trace view model from a recommendation package. */
export function buildDecisionTraceViewModel(
  pkg: RecommendationPackage,
  state: ScreenState = "ready",
): DecisionTraceViewModel {
  const trace = pkg.decisionTrace;
  return {
    package: pkg,
    cascade: {
      conversation: trace.inputSummary,
      facts: trace.extractedFacts,
      context: trace.retrievedContext,
      routes: trace.routeScores,
      decision: humanizeAction(trace.chosenAction),
      draft: pkg.draft?.body,
    },
    state,
  };
}

export function buildMissionSetupViewModel(
  objective?: UserObjectiveProfile,
): MissionSetupViewModel {
  return {
    activeObjective: objective,
    state: objective ? "ready" : "empty",
  };
}

export function buildCaptureScreenViewModel(
  objective?: UserObjectiveProfile,
): CaptureScreenViewModel {
  return {
    activeObjective: objective,
    acceptableUseText: ACCEPTABLE_USE_TEXT,
    supportedCaptureTypes: ["text", "voice", "card"],
    state: objective ? "ready" : "blocked",
  };
}

export function buildContactListViewModel(
  contacts: ContactSummary[],
): ContactListViewModel {
  return {
    contacts,
    state: contacts.length ? "ready" : "empty",
  };
}

export function buildPersonViewModel(input: {
  contactId: string;
  recommendationPackage?: RecommendationPackage;
  evidenceBundle?: EvidenceBundle;
  state?: ScreenState;
}): PersonViewModel {
  return {
    contactId: input.contactId,
    recommendationPackage: input.recommendationPackage,
    evidenceBundle: input.evidenceBundle,
    state:
      input.state ??
      (input.recommendationPackage || input.evidenceBundle ? "ready" : "empty"),
  };
}

const BOARD_STATUS_ORDER: FollowUpBoardCard["status"][] = [
  "new",
  "drafted",
  "sent",
  "reply",
  "booked",
];

export function buildFollowUpBoardViewModel(
  cards: FollowUpBoardCard[],
): FollowUpBoardViewModel {
  const columns = BOARD_STATUS_ORDER.map((status) => ({
    status,
    cards: cards.filter((card) => card.status === status),
  }));
  return {
    columns,
    state: cards.length ? "ready" : "empty",
  };
}

export function buildTractionViewModel(
  summary: TractionSummary,
  state: ScreenState = "ready",
): TractionViewModel {
  return { summary, state };
}

/**
 * Build the opportunity terminal view model. Adapts to whichever objective is
 * active — it is NOT founder-by-default. Opportunity mix is derived from routes.
 */
export function buildOpportunityTerminalViewModel(input: {
  objective?: UserObjectiveProfile;
  routes: OpportunityRoute[];
  boardCards: FollowUpBoardCard[];
}): OpportunityTerminalViewModel {
  const { objective, routes, boardCards } = input;

  const byType = new Map<OpportunityRoute["type"], { count: number; total: number }>();
  for (const route of routes) {
    const entry = byType.get(route.type) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += route.score;
    byType.set(route.type, entry);
  }
  const opportunityMix = Array.from(byType.entries())
    .map(([route, { count, total }]) => ({
      route,
      count,
      averageScore: count ? total / count : 0,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);

  const coverageGaps = deriveCoverageGaps(objective, opportunityMix.map((m) => m.route));

  const usedToday = boardCards.filter(
    (c) => c.status === "sent" || c.status === "drafted",
  ).length;
  const budget = objective?.attentionBudgetToday ?? 5;
  const attentionBudgetRemaining = Math.max(0, budget - usedToday);

  const actionQueue = [...boardCards]
    .filter((c) => c.status === "new" || c.status === "drafted")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    activeObjective: objective,
    opportunityMix,
    coverageGaps,
    recommendedClusters: [],
    actionQueue,
    attentionBudgetRemaining,
    state: objective ? "ready" : "empty",
  };
}

/** Map a user's active goals onto the opportunity routes they should be covering. */
const GOAL_TO_ROUTE: Record<string, OpportunityRoute["type"]> = {
  raise: "raise",
  hire: "hire",
  find_users: "user",
  find_design_partners: "partner",
  find_mentors: "mentor",
  find_investments: "raise",
  source_candidates: "candidate",
  find_customers: "customer",
  find_partners: "partner",
  find_job_opportunities: "job",
  build_community: "community",
  collect_wtp: "customer",
};

function deriveCoverageGaps(
  objective: UserObjectiveProfile | undefined,
  coveredRoutes: OpportunityRoute["type"][],
): string[] {
  if (!objective) return [];
  const covered = new Set(coveredRoutes);
  const gaps: string[] = [];
  for (const goal of objective.activeGoals) {
    const route = GOAL_TO_ROUTE[goal];
    if (route && !covered.has(route)) {
      gaps.push(`No "${route}" opportunities captured yet for goal: ${humanizeGoal(goal)}.`);
    }
  }
  return gaps;
}

/** Turn a recommended-action enum into a short, human, non-pushy phrase. */
export function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    SEND_FIRST_FOLLOWUP: "Send first follow-up",
    SEND_DRAFT: "Send drafted follow-up",
    SEND_NUDGE: "Send a light nudge",
    REPLY_NOW: "Reply now",
    ASK_SHARP_QUESTION: "Ask a sharp question",
    SEND_EARLY_ACCESS: "Offer early access",
    SEND_DECK: "Share the deck",
    PROPOSE_COFFEE: "Propose coffee",
    PROPOSE_PILOT: "Propose a pilot",
    MAKE_INTRO: "Make an introduction",
    WAIT: "Wait",
    SNOOZE: "Snooze",
    DO_NOT_CONTACT: "Do not contact",
    CONFIRM_DETAILS: "Confirm details",
    STAY_CALM: "No action needed",
  };
  return map[action] ?? action.replaceAll("_", " ").toLowerCase();
}

export function humanizeGoal(goal: string): string {
  return goal.replaceAll("_", " ");
}

export function humanizeRouteType(type: string): string {
  const map: Record<string, string> = {
    raise: "Fundraising",
    hire: "Hiring",
    user: "Users",
    partner: "Partnerships",
    mentor: "Mentorship",
    candidate: "Candidates",
    customer: "Customers",
    sponsor: "Sponsors",
    job: "Job leads",
    community: "Community",
    other: "Other",
  };
  return map[type] ?? type;
}

/** Build a contact summary list from a fixture dataset (single demo contact). */
export function contactSummariesFromDataset(
  dataset: FrontendMockDataset,
): ContactSummary[] {
  const card = dataset.recommendationPackage.boardCard;
  return [
    {
      id: card.contactId,
      name: card.contactName ?? dataset.extractionHandoff.contactCandidate.name ?? null,
      company: card.company ?? dataset.extractionHandoff.contactCandidate.company ?? null,
      role: dataset.extractionHandoff.contactCandidate.role ?? null,
      status: card.status,
      lastRelevantActionAt: card.updatedAt,
    },
  ];
}

/**
 * A small derived board: the demo dataset's primary card plus illustrative peers
 * so the board shows at least one card per status (per the Part 4 fixture plan)
 * without inventing live data. Peers are clearly demo-only.
 */
export function boardCardsFromDataset(
  dataset: FrontendMockDataset,
): FollowUpBoardCard[] {
  const primary = dataset.recommendationPackage.boardCard;
  const now = primary.updatedAt;
  const peers: FollowUpBoardCard[] = [
    {
      contactId: "contact_demo_2",
      recommendationId: "rec_demo_2",
      contactName: "Jordan",
      company: "Northwind Labs",
      status: "drafted",
      recommendedAction: "SEND_DRAFT",
      priorityScore: 0.62,
      urgencyScore: 0.4,
      warmthScore: 0.54,
      warning: false,
      updatedAt: now,
    },
    {
      contactId: "contact_demo_3",
      recommendationId: "rec_demo_3",
      contactName: "Priya",
      company: "Atlas Capital",
      status: "sent",
      recommendedAction: "PROPOSE_COFFEE",
      priorityScore: 0.5,
      urgencyScore: 0.3,
      warmthScore: 0.32,
      warning: true,
      warningReason: "Sent 6 days ago with no reply — a light nudge may help.",
      updatedAt: now,
    },
    {
      contactId: "contact_demo_4",
      recommendationId: "rec_demo_4",
      contactName: "Sam",
      company: "Forge",
      status: "reply",
      recommendedAction: "REPLY_NOW",
      priorityScore: 0.7,
      urgencyScore: 0.66,
      warmthScore: 0.7,
      warning: false,
      updatedAt: now,
    },
    {
      contactId: "contact_demo_5",
      recommendationId: "rec_demo_5",
      contactName: "Lena",
      company: "Quay",
      status: "booked",
      recommendedAction: "STAY_CALM",
      priorityScore: 0.4,
      urgencyScore: 0.1,
      warmthScore: 0.2,
      // Booked cards must never flag as cold.
      warning: false,
      updatedAt: now,
    },
  ];
  return [primary, ...peers];
}

/** Contact summaries for the full demo board (primary + illustrative peers). */
export function boardContactSummariesFromDataset(
  dataset: FrontendMockDataset,
): ContactSummary[] {
  const [primary, ...rest] = contactSummariesFromDataset(dataset);
  const peers = boardCardsFromDataset(dataset)
    .slice(1)
    .map((card) => ({
      id: card.contactId,
      name: card.contactName ?? null,
      company: card.company ?? null,
      role: null,
      status: card.status,
      lastRelevantActionAt: card.updatedAt,
    }));
  return [primary, ...rest, ...peers];
}

/**
 * Illustrative next-cluster recommendations derived from the active objective.
 * Demo-only: a calm suggestion of where to spend the next batch of attention.
 */
export function clusterRecommendationsFromDataset(
  dataset: FrontendMockDataset,
): ClusterRecommendation[] {
  const goal = dataset.objective.primaryGoal;
  const routeType = GOAL_TO_ROUTE[goal] ?? "user";
  return [
    {
      clusterName: `${humanizeRouteType(routeType)} — warm & fresh`,
      score: 0.78,
      why: [
        "Several recent conversations match your primary goal",
        "Still warm — worth a follow-up before they cool",
      ],
      suggestedAction: "Send the drafted follow-ups you have ready",
      expectedSignal: "Replies and early-access sign-ups",
      confidence: 0.74,
    },
  ];
}

/** A reasonable fixture traction summary when no live outcomes exist. */
export function tractionFromDataset(dataset: FrontendMockDataset): TractionSummary {
  const reply = dataset.recommendationPackage.routes[0]?.type ?? "user";
  return {
    followUpsSent: 4,
    repliesReceived: 2,
    bookedMeetings: 1,
    wtpSignals: 1,
    paidCommits: 0,
    replyRateByOpportunityType: { [reply]: 0.5 },
    actionsCompleted: 6,
    contactsArchivedOrIgnored: 1,
  };
}
