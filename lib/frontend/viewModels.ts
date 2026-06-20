import "server-only";

import { demoObjective } from "@/lib/demo/fixtures";
import {
  DEMO_USER_ID,
  getActiveObjective,
  getContact,
  getDraftForRecommendation,
  listContacts,
  listEvidenceFacts,
  listOutcomes,
  listRecommendations,
  listSourceRecords,
} from "@/lib/db/queries";
import {
  dailyBrief as demoDailyBrief,
  missionRadar as demoMissionRadar,
  outcomeLoop as demoOutcomeLoop,
  personIntelligence as demoPersonIntelligence,
  relationshipBoard as demoRelationshipBoard,
} from "@/lib/frontend/mockData";
import {
  scoreStoredRelationshipMoves,
  selectStoredDailyMoves
} from "@/lib/intelligence/layer5/adapters";
import type {
  ActionRecommendation,
  Contact,
  CaptureScreenViewModel,
  DailyMoveDecision,
  Draft,
  FollowUpBoardViewModel as BaseFollowUpBoardViewModel,
  Id,
  OpportunityTerminalViewModel,
  OpportunityType,
  OutcomeType,
  PersonViewModel,
  RecommendedActionType,
  TractionSummary,
  TractionViewModel,
  UserObjectiveProfile,
} from "@/lib/types";

export interface BriefMove {
  id: string;
  name: string;
  role: string;
  initials: string;
  signal: "follow" | "hold" | "network";
  label: string;
  action: string;
  reason: string;
  whyNow: string[];
  whatToAvoid: string[];
  costOfSilence: string;
  href?: string;
}

export interface DailyBriefViewModel {
  activeObjective: UserObjectiveProfile;
  missionTitle: string;
  missionContext: string;
  currentDate: string;
  headline: string;
  moves: BriefMove[];
  cooling?: BriefMove;
  missionGap: string;
  proof: {
    label: string;
    value: string;
    note: string;
  }[];
}

export interface RadarNode {
  id: string;
  name: string;
  initials: string;
  x: number;
  y: number;
  state: "action" | "warm" | "waiting" | "cooling" | "gap";
  note: string;
  href?: string;
}

export interface MissionRadarViewModel {
  objective: UserObjectiveProfile;
  missionTitle: string;
  nodes: RadarNode[];
  bridges: { from: string; to: string; label: string }[];
}

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
  evidence: {
    facts: string[];
    sourceCount: number;
    warnings: string[];
    confidence: {
      entityMatch: number;
      sourceConfidence: number;
      factConfidence: number;
      finalConfidence: number;
    };
  };
  recommendation: {
    id?: Id;
    contactId?: Id;
    title: string;
    reason: string;
    avoid: string;
    draft: string;
    whyNow: string[];
    whyThisAction: string[];
    whyNot: string[];
    whatToAvoid: string[];
    risks: string[];
    safeFacts: string[];
    blockedFacts: string[];
    costOfSilence: string;
  };
}

export interface BoardCard {
  id: string;
  name: string;
  role: string;
  label: string;
  note: string;
  action: string;
  disabled?: boolean;
  href?: string;
  contactId?: Id;
  recommendationId?: Id;
  draftBody?: string;
  whyNow?: string;
  whatToAvoid?: string;
  relationshipState?: DailyMoveDecision["relationshipState"];
}

export interface BoardSection {
  id: string;
  title: string;
  context: string;
  tone: "urgent" | "warm" | "waiting" | "cooling" | "dormant";
  cards: BoardCard[];
}

export interface RelationshipBoardViewModel extends BaseFollowUpBoardViewModel {
  sections: BoardSection[];
}

export interface OutcomeLoopViewModel extends TractionViewModel {
  contact: PersonIntelligenceViewModel["contact"];
  prompt: string;
  target?: {
    userId: Id;
    contactId: Id;
    recommendationId?: Id;
  };
  options: {
    id: string;
    label: string;
    kind: "positive" | "neutral" | "negative";
    outcomeType: OutcomeType;
  }[];
}

const ALL_OPPORTUNITY_TYPES: OpportunityType[] = [
  "raise",
  "hire",
  "user",
  "partner",
  "mentor",
  "candidate",
  "customer",
  "sponsor",
  "job",
  "community",
  "other",
];

function activeObjective(userId = DEMO_USER_ID): UserObjectiveProfile {
  return getActiveObjective(userId) ?? (canUseDemoFallback(userId) ? demoObjective : defaultObjective(userId));
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function missionTitle(objective: UserObjectiveProfile): string {
  if (
    objective.primaryGoal === "hire" ||
    objective.activeGoals.includes("source_candidates")
  ) {
    return "Recruit Core Talent";
  }
  if (objective.primaryGoal === "find_users") return "Find Design Users";
  if (objective.primaryGoal === "raise") return "Build Investor Momentum";
  if (objective.primaryGoal === "collect_wtp") return "Validate Willingness To Pay";
  return titleCase(objective.primaryGoal);
}

function missionGap(objective: UserObjectiveProfile): string {
  if (objective.hiringNeeds?.length) {
    return `Still missing ${objective.hiringNeeds.join(", ").toLowerCase()}.`;
  }
  if (objective.primaryGoal === "find_users") {
    return "Still missing enough high-fit users with an explicit next event.";
  }
  if (objective.primaryGoal === "raise") {
    return "Still missing investor conversations with clear thesis fit.";
  }
  return `Still missing relationships that directly advance ${titleCase(objective.primaryGoal).toLowerCase()}.`;
}

function formatDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function defaultObjective(userId: Id): UserObjectiveProfile {
  const timestamp = new Date().toISOString();
  return {
    id: `obj_${userId}_setup`,
    userId,
    role: "founder",
    primaryGoal: "find_users",
    activeGoals: ["find_users"],
    secondaryGoals: [],
    eventContext: null,
    companyName: null,
    companyStage: null,
    productDescription: null,
    targetCustomer: null,
    currentTraction: null,
    fundraisingStatus: null,
    hiringNeeds: [],
    attentionBudgetToday: 3,
    preferredTone: "warm",
    constraints: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function initials(name?: string | null): string {
  const parts = (name ?? "Unknown Contact")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "UC";
}

function formatAction(action: RecommendedActionType): string {
  const labels: Record<RecommendedActionType, string> = {
    SEND_FIRST_FOLLOWUP: "Send first follow-up",
    SEND_DRAFT: "Send draft",
    SEND_NUDGE: "Send nudge",
    REPLY_NOW: "Reply now",
    ASK_SHARP_QUESTION: "Ask sharp question",
    SEND_EARLY_ACCESS: "Send early access",
    SEND_DECK: "Send deck",
    PROPOSE_COFFEE: "Propose coffee",
    PROPOSE_PILOT: "Propose pilot",
    MAKE_INTRO: "Make intro",
    WAIT: "Wait",
    SNOOZE: "Snooze",
    DO_NOT_CONTACT: "Do not contact",
    CONFIRM_DETAILS: "Confirm details",
    STAY_CALM: "Stay calm",
  };
  return labels[action] ?? titleCase(action);
}

function relationshipActionLabel(action: DailyMoveDecision["recommendedAction"]): string {
  return titleCase(action);
}

function moveSignal(move: DailyMoveDecision): BriefMove["signal"] {
  if (move.recommendedAction === "make_intro") return "network";
  if (["wait", "snooze", "do_not_act", "confirm_details"].includes(move.recommendedAction)) {
    return "hold";
  }
  return "follow";
}

function moveLabel(move: DailyMoveDecision): string {
  if (move.recommendedAction === "confirm_details") return "Confirm first";
  if (move.suggestedTiming === "today") return "Best move today";
  if (move.relationshipState === "cooling") return "Cooling";
  if (move.suggestedTiming === "wait") return "Wait";
  return "Next best move";
}

function costOfSilenceLabel(move: DailyMoveDecision): string {
  if (move.costOfSilence >= 0.35) return "High cost of silence";
  if (move.costOfSilence >= 0.15) return "Medium cost of silence";
  return "Low cost to wait";
}

function contactFor(rec: ActionRecommendation): Contact | null {
  return getContact(rec.contactId);
}

function firstReason(rec: ActionRecommendation): string {
  return (
    rec.explanation.whyThisAction[0] ??
    rec.explanation.safeFactsUsed[0] ??
    rec.explanation.inputSummary ??
    "The decision engine found this to be the strongest next step."
  );
}

function firstAvoidance(rec: ActionRecommendation): string {
  return (
    rec.explanation.whyNotOtherActions[0] ??
    rec.explanation.warnings[0] ??
    "Do not automate outreach; keep the final action user-controlled."
  );
}

function buildPart5Move(move: DailyMoveDecision): BriefMove {
  return {
    id: move.relationshipId,
    name: move.contactName ?? "Unknown contact",
    role: [move.company, move.relationshipState].filter(Boolean).join(" · "),
    initials: initials(move.contactName),
    signal: moveSignal(move),
    label: moveLabel(move),
    action: relationshipActionLabel(move.recommendedAction),
    reason: move.whyNow[0] ?? move.whyThisAction[0] ?? "This move best fits today's relationship policy.",
    whyNow: move.whyNow,
    whatToAvoid: move.whatToAvoid,
    costOfSilence: costOfSilenceLabel(move),
    href: `/contacts/${move.contactId}`,
  };
}

function liveRecommendations(userId: Id): ActionRecommendation[] {
  return listRecommendations(userId).filter(
    (rec) => rec.status === "pending",
  );
}

function emptyTraction(): TractionSummary {
  return {
    followUpsSent: 0,
    repliesReceived: 0,
    bookedMeetings: 0,
    wtpSignals: 0,
    paidCommits: 0,
    replyRateByOpportunityType: {},
    actionsCompleted: 0,
    contactsArchivedOrIgnored: 0,
  };
}

function tractionSummary(userId: Id): TractionSummary {
  const outcomes = listOutcomes(userId);
  if (!outcomes.length) return emptyTraction();

  const count = (type: OutcomeType) =>
    outcomes.filter((outcome) => outcome.outcomeType === type).length;
  const replyRateByOpportunityType: Partial<Record<OpportunityType, number>> = {};

  for (const type of ALL_OPPORTUNITY_TYPES) {
    const matching = outcomes.filter((outcome) => {
      const rec = outcome.recommendationId
        ? listRecommendations(userId).find((item) => item.id === outcome.recommendationId)
        : undefined;
      return rec?.explanation.chosenRoute.type === type;
    });
    if (matching.length > 0) {
      replyRateByOpportunityType[type] =
        matching.filter((outcome) => outcome.outcomeType === "reply").length /
        matching.length;
    }
  }

  const followUpsSent = count("sent");
  const repliesReceived = count("reply");
  const bookedMeetings = count("booked");
  const wtpSignals = count("wtp");
  const paidCommits = count("paid");

  return {
    followUpsSent,
    repliesReceived,
    bookedMeetings,
    wtpSignals,
    paidCommits,
    replyRateByOpportunityType,
    actionsCompleted:
      followUpsSent + repliesReceived + bookedMeetings + wtpSignals + paidCommits,
    contactsArchivedOrIgnored: count("ignored") + count("marked_not_relevant"),
  };
}

function demoBriefWithObjective(objective: UserObjectiveProfile): DailyBriefViewModel {
  const moves = demoDailyBrief.moves.map((move) => ({
    ...move,
    whyNow: [move.reason],
    whatToAvoid: ["Do not automate outreach; keep the final action user-controlled."],
    costOfSilence: "Demo policy preview",
  }));
  return {
    ...demoDailyBrief,
    activeObjective: objective,
    missionTitle: missionTitle(objective),
    missionContext: objective.eventContext ?? "Active mission context",
    currentDate: formatDate(),
    moves,
    cooling: demoDailyBrief.cooling
      ? {
          ...demoDailyBrief.cooling,
          whyNow: [demoDailyBrief.cooling.reason],
          whatToAvoid: ["Keep the re-engagement light and specific."],
          costOfSilence: "Medium cost of silence",
        }
      : undefined,
  };
}

function canUseDemoFallback(userId: Id): boolean {
  return userId === DEMO_USER_ID && process.env.AFTERMEET_DEMO_MODE !== "false";
}

function emptyBriefWithObjective(objective: UserObjectiveProfile): DailyBriefViewModel {
  return {
    activeObjective: objective,
    missionTitle: missionTitle(objective),
    missionContext: objective.eventContext ?? "Setup",
    currentDate: formatDate(),
    headline: "No relationship moves yet",
    moves: [],
    missionGap: missionGap(objective),
    proof: [
      { label: "Today", value: "0", note: "relationship moves" },
      { label: "Warm", value: "0", note: "relationships captured" },
      { label: "Blocked", value: "0", note: "waiting or hold states" },
    ],
  };
}

export function getDailyBriefViewModel(userId = DEMO_USER_ID): DailyBriefViewModel {
  const objective = activeObjective(userId);
  const recs = liveRecommendations(userId);
  if (!recs.length) {
    return canUseDemoFallback(userId)
      ? demoBriefWithObjective(objective)
      : emptyBriefWithObjective(objective);
  }

  const dailyMoves = selectStoredDailyMoves({
    userId,
    objective,
    generatedAt: new Date().toISOString()
  });
  const moves = dailyMoves.map(buildPart5Move);
  const scoredMoves = scoreStoredRelationshipMoves({
    userId,
    objective,
    generatedAt: new Date().toISOString()
  });
  const coolingMove = scoredMoves.find((move) => move.relationshipState === "cooling");
  const sentOrWaiting = recs.filter(
    (rec) =>
      rec.status === "sent" ||
      ["WAIT", "SNOOZE", "DO_NOT_CONTACT", "STAY_CALM"].includes(rec.recommendedAction),
  ).length;

  return {
    activeObjective: objective,
    missionTitle: missionTitle(objective),
    missionContext: objective.eventContext ?? "Active mission context",
    currentDate: formatDate(),
    headline: moves.length
      ? `${moves.length} best move${moves.length === 1 ? "" : "s"} can advance ${missionTitle(objective)}`
      : "No critical relationship moves today",
    moves,
    cooling: coolingMove ? buildPart5Move(coolingMove) : undefined,
    missionGap: missionGap(objective),
    proof: [
      { label: "Today", value: String(moves.length), note: "high-leverage moves" },
      { label: "Warm", value: String(listContacts(userId).length), note: "relationships captured" },
      { label: "Blocked", value: String(sentOrWaiting), note: "waiting or hold states" },
    ],
  };
}

export function getMissionRadarViewModel(userId = DEMO_USER_ID): MissionRadarViewModel {
  const objective = activeObjective(userId);
  const recs = liveRecommendations(userId);
  if (!recs.length) {
    return {
      ...demoMissionRadar,
      objective,
      missionTitle: missionTitle(objective),
    };
  }

  const scoredMoves = scoreStoredRelationshipMoves({
    userId,
    objective,
    generatedAt: new Date().toISOString()
  });

  const nodes: RadarNode[] = scoredMoves.slice(0, 7).map((move) => {
    const name = move.contactName ?? "Unknown";
    return {
      id: move.relationshipId,
      name,
      initials: initials(name),
      x: Math.round(12 + move.scoreBreakdown.missionImpact * 78),
      y: Math.round(12 + move.scoreBreakdown.timingWindow * 78),
      state:
        move.recommendedAction === "confirm_details" || move.suggestedTiming === "wait"
          ? "waiting"
          : move.relationshipState === "cooling"
            ? "cooling"
            : move.dailyPriority >= 0.12
              ? "action"
              : "warm",
      note: move.whyNow[0] ?? move.whyThisAction[0],
      href: `/contacts/${move.contactId}`,
    };
  });

  nodes.push({
    id: "mission-gap",
    name: "Mission gap",
    initials: "MG",
    x: 52,
    y: 18,
    state: "gap",
    note: missionGap(objective),
  });

  const bridges = scoredMoves
    .filter(
      (move) =>
        move.recommendedAction === "make_intro" ||
        move.scoreBreakdown.missionImpact >= 0.55,
    )
    .slice(0, 3)
    .map((move) => {
      return {
        from: move.contactName ?? "contact",
        to: "mission gap",
        label: relationshipActionLabel(move.recommendedAction),
      };
    });

  return {
    objective,
    missionTitle: missionTitle(objective),
    nodes,
    bridges: bridges.length
      ? bridges
      : [{ from: "daily brief", to: "mission gap", label: "next relationship signal" }],
  };
}

function cardForMove(move: DailyMoveDecision, userId: Id): BoardCard {
  const rec = getRecommendationForContactSafe(move.contactId, userId);
  const draft = rec ? getDraftForRecommendation(rec.id) : null;
  return {
    id: move.relationshipId,
    name: move.contactName ?? "Unknown contact",
    role: [move.company, move.relationshipState].filter(Boolean).join(" · "),
    label: moveLabel(move),
    note: move.whyNow[0] ?? move.whyThisAction[0] ?? "Daily policy selected this relationship state.",
    action: relationshipActionLabel(move.recommendedAction),
    disabled: ["wait", "snooze", "confirm_details", "do_not_act"].includes(move.recommendedAction),
    href: `/contacts/${move.contactId}`,
    contactId: move.contactId,
    recommendationId: rec?.id,
    draftBody: draft?.body,
    whyNow: move.whyNow[0],
    whatToAvoid: move.whatToAvoid[0],
    relationshipState: move.relationshipState,
  };
}

function getRecommendationForContactSafe(contactId: Id, userId: Id): ActionRecommendation | null {
  return liveRecommendations(userId).find((rec) => rec.contactId === contactId) ?? null;
}

export function getRelationshipBoardViewModel(userId = DEMO_USER_ID): RelationshipBoardViewModel {
  const recs = liveRecommendations(userId);
  if (!recs.length) return demoRelationshipBoard;

  const sections: BoardSection[] = [
    {
      id: "needs-action",
      title: "Act Today",
      context: "Daily policy selected",
      tone: "urgent",
      cards: [],
    },
    {
      id: "confirm",
      title: "Confirm First",
      context: "Useful but uncertain",
      tone: "warm",
      cards: [],
    },
    {
      id: "waiting",
      title: "Waiting",
      context: "External dependency",
      tone: "waiting",
      cards: [],
    },
    {
      id: "cooling",
      title: "Cooling",
      context: "Risk of fade",
      tone: "cooling",
      cards: [],
    },
    {
      id: "dormant",
      title: "Dormant",
      context: "No critical revivals",
      tone: "dormant",
      cards: [],
    },
  ];

  const scoredMoves = scoreStoredRelationshipMoves({
    userId,
    objective: activeObjective(userId),
    generatedAt: new Date().toISOString()
  });

  for (const move of scoredMoves) {
    const card = cardForMove(move, userId);
    if (move.recommendedAction === "confirm_details") sections[1].cards.push(card);
    else if (move.recommendedAction === "wait" || move.recommendedAction === "snooze" || move.relationshipState === "waiting") sections[2].cards.push(card);
    else if (move.relationshipState === "cooling") sections[3].cards.push(card);
    else if (move.dailyPriority >= 0.12 || move.suggestedTiming === "today") sections[0].cards.push(card);
    else sections[4].cards.push(card);
  }

  return {
    state: "ready",
    columns: [],
    sections,
  };
}

function missionFitLabel(score: number): PersonIntelligenceViewModel["missionFit"] {
  if (score >= 0.7) return "Strong";
  if (score >= 0.45) return "Promising";
  return "Weak";
}

function warmthLabel(rec?: ActionRecommendation): PersonIntelligenceViewModel["warmth"] {
  if (!rec) return "Medium";
  if (rec.urgencyScore >= 0.72) return "Cooling";
  if (rec.recipientBurden <= 0.45 && rec.status === "pending") return "High";
  return "Medium";
}

function fallbackPerson(): PersonIntelligenceViewModel {
  const recommendation = {
    ...demoPersonIntelligence.recommendation,
    whyNow: [demoPersonIntelligence.systemNote],
    whyThisAction: [demoPersonIntelligence.recommendation.reason],
    whyNot: [],
    whatToAvoid: [demoPersonIntelligence.recommendation.avoid],
    risks: [],
    safeFacts: [],
    blockedFacts: [],
    costOfSilence: "Demo policy preview",
  };
  return {
    ...demoPersonIntelligence,
    recommendation,
    evidence: {
      facts: [],
      sourceCount: 0,
      warnings: [],
      confidence: {
        entityMatch: 0,
        sourceConfidence: 0,
        factConfidence: 0,
        finalConfidence: 0,
      },
    },
  };
}

function demoOutcomeWithTypes(): OutcomeLoopViewModel {
  const outcomeTypes: OutcomeType[] = [
    "reply",
    "booked",
    "wtp",
    "paid",
    "marked_not_relevant",
    "ignored",
  ];
  return {
    ...demoOutcomeLoop,
    options: demoOutcomeLoop.options.map((option, index) => ({
      ...option,
      outcomeType: outcomeTypes[index] ?? "manual_override",
    })),
  };
}

export function getPersonIntelligenceViewModel(
  contactId?: Id,
  userId = DEMO_USER_ID,
): PersonIntelligenceViewModel {
  const recs = liveRecommendations(userId);
  const selectedRec =
    (contactId
      ? recs.find((rec) => rec.contactId === contactId)
      : undefined) ?? recs[0];
  const contact =
    (contactId ? getContact(contactId) : null) ??
    (selectedRec ? getContact(selectedRec.contactId) : null);

  if (!contact) return fallbackPerson();

  const rec =
    selectedRec ??
    recs.find((candidate) => candidate.contactId === contact.id);
  const draft: Draft | null = rec ? getDraftForRecommendation(rec.id) : null;
  const move = scoreStoredRelationshipMoves({
    userId,
    objective: activeObjective(userId),
    generatedAt: new Date().toISOString()
  }).find((candidate) => candidate.contactId === contact.id);
  const evidenceFacts = listEvidenceFacts(contact.id)
    .sort((left, right) => right.factConfidence - left.factConfidence)
    .slice(0, 5);
  const sourceCount = listSourceRecords(contact.id).length;
  const confidence = rec?.explanation.confidenceBreakdown;
  const safeFacts = rec?.explanation.safeFactsUsed ?? [];
  const facts = evidenceFacts.length
    ? evidenceFacts.map((fact) => fact.fact)
    : safeFacts.slice(0, 5);

  const company = contact.company ?? "Unknown company";
  const role = contact.role ?? "Relationship contact";

  return {
    contactId: contact.id,
    state: "ready",
    contact: {
      name: contact.name ?? "Unknown contact",
      role,
      company,
      initials: initials(contact.name),
      location: contact.website ?? contact.linkedinUrl ?? "Captured from conversation",
    },
    warmth: warmthLabel(rec),
    missionFit: missionFitLabel(confidence?.userGoalFit ?? 0.5),
    systemNote: move
      ? `${costOfSilenceLabel(move)}. ${move.whyNow[0] ?? "Daily policy scored this relationship."}`
      : rec
        ? `${facts.length || safeFacts.length} usable fact${facts.length === 1 ? "" : "s"} and ${sourceCount} public source${sourceCount === 1 ? "" : "s"} inform this recommendation.`
      : "Captured contact is ready for enrichment and recommendation.",
    evidence: {
      facts,
      sourceCount,
      warnings: rec?.explanation.warnings ?? [],
      confidence: {
        entityMatch: confidence?.entityMatch ?? contact.entityMatchConfidence ?? 0,
        sourceConfidence: confidence?.sourceConfidence ?? 0,
        factConfidence: confidence?.factConfidence ?? 0,
        finalConfidence: confidence?.finalConfidence ?? rec?.confidence ?? 0,
      },
    },
    recommendation: {
      id: rec?.id,
      contactId: contact.id,
      title: move
        ? `Best move today: ${relationshipActionLabel(move.recommendedAction).toLowerCase()}`
        : rec
          ? `Best move today: ${formatAction(rec.recommendedAction).toLowerCase()}`
          : "No recommendation yet",
      reason: move ? move.whyThisAction[0] ?? move.whyNow[0] : rec ? firstReason(rec) : "Capture or enrich more context to produce a decision trace.",
      avoid: move ? move.whatToAvoid[0] ?? "Keep the final action user-controlled." : rec ? firstAvoidance(rec) : "Do not contact until the context is clear enough.",
      draft: draft?.body ?? "No draft has been generated for this recommendation yet.",
      whyNow: move?.whyNow ?? [],
      whyThisAction: move?.whyThisAction ?? [],
      whyNot: move?.whyNot ?? [],
      whatToAvoid: move?.whatToAvoid ?? (rec ? [firstAvoidance(rec)] : []),
      risks: move?.risks ?? [],
      safeFacts: move?.safeFactsForDraft ?? safeFacts,
      blockedFacts: move?.blockedFacts ?? [],
      costOfSilence: move ? costOfSilenceLabel(move) : "Not scored by daily policy",
    },
  };
}

export function getOutcomeLoopViewModel(userId = DEMO_USER_ID): OutcomeLoopViewModel {
  const recs = liveRecommendations(userId);
  const target =
    recs.find((rec) => rec.status === "pending" || rec.status === "sent") ??
    recs[0];
  if (!target) return demoOutcomeWithTypes();

  const contact = contactFor(target);
  const contactName = contact?.name ?? "this relationship";
  const summary = tractionSummary(userId);

  return {
    state: "ready",
    summary,
    contact: {
      name: contactName,
      role: contact?.role ?? "Relationship contact",
      company: contact?.company ?? "Unknown company",
      initials: initials(contactName),
      location: contact?.website ?? contact?.linkedinUrl ?? "Captured from conversation",
    },
    prompt: `How did the move with ${contactName} go?`,
    target: {
      userId,
      contactId: target.contactId,
      recommendationId: target.id,
    },
    options: [
      { id: "reply", label: "Replied", kind: "positive", outcomeType: "reply" },
      { id: "booked", label: "Meeting booked", kind: "positive", outcomeType: "booked" },
      { id: "wtp", label: "WTP signal", kind: "positive", outcomeType: "wtp" },
      { id: "paid", label: "Paid / converted", kind: "positive", outcomeType: "paid" },
      { id: "not-relevant", label: "Not relevant", kind: "negative", outcomeType: "marked_not_relevant" },
      { id: "no-response", label: "No response", kind: "neutral", outcomeType: "ignored" },
    ],
  };
}

export function getCaptureScreenViewModel(userId = DEMO_USER_ID): CaptureScreenViewModel {
  return {
    activeObjective: activeObjective(userId),
    acceptableUseText:
      "Capture your own meeting notes only. Aftermeet keeps the final recommendation user-controlled.",
    supportedCaptureTypes: ["text", "voice", "card"],
    state: "ready",
  };
}

export function getObjectiveViewModel(userId = DEMO_USER_ID): OpportunityTerminalViewModel["activeObjective"] {
  return activeObjective(userId);
}
