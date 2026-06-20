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
import type {
  ActionRecommendation,
  Contact,
  CaptureScreenViewModel,
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
  return getActiveObjective(userId) ?? demoObjective;
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

function actionSignal(action: RecommendedActionType): BriefMove["signal"] {
  if (action === "MAKE_INTRO") return "network";
  if (["WAIT", "SNOOZE", "DO_NOT_CONTACT", "STAY_CALM"].includes(action)) {
    return "hold";
  }
  return "follow";
}

function actionLabel(rec: ActionRecommendation): string {
  if (rec.status === "sent") return "Sent";
  if (rec.status === "snoozed") return "Snoozed";
  if (rec.status === "archived") return "Archived";
  if (rec.recommendedAction === "MAKE_INTRO") return "Intro path";
  if (actionSignal(rec.recommendedAction) === "hold") return "Hold";
  if (rec.urgencyScore >= 0.7) return "Follow today";
  return "Next best move";
}

function contactFor(rec: ActionRecommendation): Contact | null {
  return getContact(rec.contactId);
}

function contactRoleLine(contact: Contact | null): string {
  return [contact?.role, contact?.company].filter(Boolean).join(" at ") || "Captured relationship";
}

function boardRoleLine(contact: Contact | null): string {
  return [contact?.role, contact?.company].filter(Boolean).join(" at ") || "Relationship signal";
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

function buildMove(rec: ActionRecommendation): BriefMove {
  const contact = contactFor(rec);
  const name = contact?.name ?? rec.explanation.chosenRoute.contactId ?? "Unknown contact";
  return {
    id: rec.id,
    name,
    role: contactRoleLine(contact),
    initials: initials(name),
    signal: actionSignal(rec.recommendedAction),
    label: actionLabel(rec),
    action: formatAction(rec.recommendedAction),
    reason: firstReason(rec),
    href: `/contacts/${rec.contactId}`,
  };
}

function liveRecommendations(userId: Id): ActionRecommendation[] {
  return listRecommendations(userId).filter(
    (rec) => rec.status !== "archived" && rec.status !== "overridden",
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
  return {
    ...demoDailyBrief,
    activeObjective: objective,
    missionTitle: missionTitle(objective),
    missionContext: objective.eventContext ?? "Active mission context",
    currentDate: formatDate(),
  };
}

export function getDailyBriefViewModel(userId = DEMO_USER_ID): DailyBriefViewModel {
  const objective = activeObjective(userId);
  const recs = liveRecommendations(userId);
  if (!recs.length) return demoBriefWithObjective(objective);

  const moves = recs.slice(0, 3).map(buildMove);
  const coolingRec =
    recs.find((rec) => rec.urgencyScore >= 0.7 || rec.recipientBurden >= 0.7) ??
    recs[0];
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
    headline: `${moves.length} move${moves.length === 1 ? "" : "s"} can advance ${missionTitle(objective)}`,
    moves,
    cooling: coolingRec ? buildMove(coolingRec) : undefined,
    missionGap: missionGap(objective),
    proof: [
      { label: "Today", value: String(moves.length), note: "high-leverage moves" },
      { label: "Warm", value: String(listContacts(userId).length), note: "relationships captured" },
      { label: "Blocked", value: String(sentOrWaiting), note: "waiting or hold states" },
    ],
  };
}

function nodeState(rec: ActionRecommendation): RadarNode["state"] {
  if (["WAIT", "SNOOZE", "DO_NOT_CONTACT", "STAY_CALM"].includes(rec.recommendedAction)) {
    return "waiting";
  }
  if (rec.urgencyScore >= 0.75) return "cooling";
  if (rec.priorityScore >= 0.65) return "action";
  return "warm";
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

  const nodes: RadarNode[] = recs.slice(0, 7).map((rec) => {
    const contact = contactFor(rec);
    const name = contact?.name ?? "Unknown";
    const goalFit = rec.explanation.confidenceBreakdown.userGoalFit;
    return {
      id: rec.id,
      name,
      initials: initials(name),
      x: Math.round(12 + Math.min(Math.max(goalFit, 0), 1) * 78),
      y: Math.round(12 + Math.min(Math.max(rec.urgencyScore, 0), 1) * 78),
      state: nodeState(rec),
      note: firstReason(rec),
      href: `/contacts/${rec.contactId}`,
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

  const bridges = recs
    .filter(
      (rec) =>
        rec.recommendedAction === "MAKE_INTRO" ||
        rec.explanation.chosenRoute.type === "partner" ||
        rec.explanation.chosenRoute.type === "candidate",
    )
    .slice(0, 3)
    .map((rec) => {
      const contact = contactFor(rec);
      return {
        from: contact?.name ?? "contact",
        to: "mission gap",
        label: titleCase(rec.explanation.chosenRoute.type),
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

function cardFor(rec: ActionRecommendation): BoardCard {
  const contact = contactFor(rec);
  const name = contact?.name ?? "Unknown contact";
  const draft = getDraftForRecommendation(rec.id);
  return {
    id: rec.id,
    name,
    role: boardRoleLine(contact),
    label: actionLabel(rec),
    note: firstReason(rec),
    action: formatAction(rec.recommendedAction),
    disabled:
      rec.status === "sent" ||
      rec.status === "snoozed" ||
      ["WAIT", "SNOOZE", "DO_NOT_CONTACT", "STAY_CALM"].includes(rec.recommendedAction),
    href: `/contacts/${rec.contactId}`,
    contactId: rec.contactId,
    recommendationId: rec.id,
    draftBody: draft?.body,
  };
}

export function getRelationshipBoardViewModel(userId = DEMO_USER_ID): RelationshipBoardViewModel {
  const recs = liveRecommendations(userId);
  if (!recs.length) return demoRelationshipBoard;

  const sections: BoardSection[] = [
    {
      id: "needs-action",
      title: "Needs Action",
      context: "High priority",
      tone: "urgent",
      cards: [],
    },
    {
      id: "warm",
      title: "Warm",
      context: "Active context",
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

  for (const rec of recs) {
    const card = cardFor(rec);
    if (rec.status === "archived") sections[4].cards.push(card);
    else if (card.disabled) sections[2].cards.push(card);
    else if (rec.urgencyScore >= 0.75) sections[3].cards.push(card);
    else if (rec.priorityScore >= 0.62) sections[0].cards.push(card);
    else sections[1].cards.push(card);
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
  return {
    ...demoPersonIntelligence,
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
    systemNote: rec
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
      title: rec ? `Best move today: ${formatAction(rec.recommendedAction).toLowerCase()}` : "No recommendation yet",
      reason: rec ? firstReason(rec) : "Capture or enrich more context to produce a decision trace.",
      avoid: rec ? firstAvoidance(rec) : "Do not contact until the context is clear enough.",
      draft: draft?.body ?? "No draft has been generated for this recommendation yet.",
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
