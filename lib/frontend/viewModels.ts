import "server-only";

import {
  DEMO_USER_ID,
  getActiveObjective,
  getContact,
  getDraftForRecommendation,
  listContacts,
  listEvidenceFacts,
  listOutcomes,
  listPublicContext,
  listRecommendations,
  listSourceRecords,
} from "@/lib/db/queries";
import { friendlyWarnings, tidyFact, tidyFacts } from "@/lib/copy";
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
  EvidenceProfile,
  FollowUpBoardViewModel as BaseFollowUpBoardViewModel,
  Id,
  OpportunityTerminalViewModel,
  OpportunityType,
  OutcomeType,
  PersonViewModel,
  RecommendedActionType,
  SourceType,
  TractionSummary,
  TractionViewModel,
  UserObjectiveProfile,
} from "@/lib/types";

export type EvidenceProvenance = "captured" | "confirmed" | "cited" | "ai_suggested";

export function evidenceProvenance(input: {
  sourceType: SourceType;
  sourceUrl?: string | null;
}): { provenance: EvidenceProvenance; sourceLabel: string } {
  if (input.sourceType === "user_confirmed") {
    return { provenance: "confirmed", sourceLabel: "Confirmed by you" };
  }
  if (["user_voice_note", "business_card", "manual"].includes(input.sourceType)) {
    return { provenance: "captured", sourceLabel: "Captured by you" };
  }
  if (input.sourceType === "cala_verified_fact") {
    return { provenance: "cited", sourceLabel: "Verified public source" };
  }
  if (input.sourceUrl) {
    return { provenance: "cited", sourceLabel: "Cited public source" };
  }
  return {
    provenance: "ai_suggested",
    sourceLabel: "AI-suggested; verify before use"
  };
}

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
  contactId?: Id;
  recommendationId?: Id;
  canDefer?: boolean;
  href?: string;
}

export interface DailyBriefViewModel {
  userId: Id;
  activeObjective: UserObjectiveProfile | null;
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
  objective: UserObjectiveProfile | null;
  missionTitle: string;
  nodes: RadarNode[];
  bridges: { id: string; from: string; to: string; label: string }[];
}

export interface PersonIntelligenceViewModel extends PersonViewModel {
  contact: {
    name: string;
    role: string;
    company: string;
    initials: string;
    location: string;
    email?: string;
    phone?: string;
    website?: string;
    linkedinUrl?: string;
  };
  warmth: "High" | "Medium" | "Cooling";
  missionFit: "Strong" | "Promising" | "Weak";
  systemNote: string;
  evidence: {
    // Cohesive profile synthesized from every source — rendered as ONE card on
    // the contact screen instead of one card per raw fact.
    profile: EvidenceProfile;
    // Distinct provenance labels behind the profile (e.g. "Verified public
    // source", "Cited public source", "Captured by you").
    sourceLabels: string[];
    sources: Array<{
      sourceName: string;
      sourceUrl?: string;
      provenance: EvidenceProvenance;
      sourceLabel: string;
    }>;
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
    actionKey?: DailyMoveDecision["recommendedAction"];
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

function activeObjective(userId = DEMO_USER_ID): UserObjectiveProfile | null {
  return getActiveObjective(userId);
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
  const primaryGoal = objective.primaryGoal ?? "find_users";
  const activeGoals = objective.activeGoals ?? [primaryGoal];
  if (
    primaryGoal === "hire" ||
    activeGoals.includes("source_candidates")
  ) {
    return "Recruit Core Talent";
  }
  if (primaryGoal === "find_users") return "Find Design Users";
  if (primaryGoal === "raise") return "Build Investor Momentum";
  if (primaryGoal === "collect_wtp") return "Confirm People Will Pay";
  return titleCase(primaryGoal);
}

function missionGap(objective: UserObjectiveProfile): string {
  const primaryGoal = objective.primaryGoal ?? "find_users";
  if (objective.hiringNeeds?.length) {
    return `Still missing ${objective.hiringNeeds.join(", ").toLowerCase()}.`;
  }
  if (primaryGoal === "find_users") {
    return "Still missing enough high-fit users with an explicit next event.";
  }
  if (primaryGoal === "raise") {
    return "Still missing investor conversations with clear thesis fit.";
  }
  return `Still missing relationships that directly advance ${titleCase(primaryGoal).toLowerCase()}.`;
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
  if (move.costOfSilence >= 0.35) return "Worth reaching out soon";
  if (move.costOfSilence >= 0.15) return "Reach out when you can";
  return "No rush";
}

function contactFor(rec: ActionRecommendation): Contact | null {
  return getContact(rec.contactId);
}

function firstReason(rec: ActionRecommendation): string {
  return (
    rec.explanation.whyThisAction[0] ??
    rec.explanation.safeFactsUsed[0] ??
    rec.explanation.inputSummary ??
    "This looked like the strongest next step."
  );
}

function firstAvoidance(rec: ActionRecommendation): string {
  return (
    rec.explanation.whyNotOtherActions[0] ??
    rec.explanation.warnings[0] ??
    "Do not automate outreach; keep the final action user-controlled."
  );
}

function buildPart5Move(move: DailyMoveDecision, userId: Id): BriefMove {
  const rec = getRecommendationForContactSafe(move.contactId, userId);
  return {
    id: move.relationshipId,
    name: move.contactName ?? "Unknown contact",
    role: [move.company, move.relationshipState].filter(Boolean).join(" · "),
    initials: initials(move.contactName),
    signal: moveSignal(move),
    label: moveLabel(move),
    action: relationshipActionLabel(move.recommendedAction),
    reason: move.whyNow[0] ?? move.whyThisAction[0] ?? "This is the best move with them today.",
    whyNow: move.whyNow,
    whatToAvoid: move.whatToAvoid,
    costOfSilence: costOfSilenceLabel(move),
    contactId: move.contactId,
    recommendationId: rec?.id,
    canDefer: move.recommendedAction === "wait" || move.recommendedAction === "snooze",
    href: `/contacts/${move.contactId}`,
  };
}

function liveRecommendations(userId: Id): ActionRecommendation[] {
  return listRecommendations(userId).filter(
    (rec) => !["archived", "overridden", "snoozed"].includes(rec.status),
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

function emptyBrief(userId: Id): DailyBriefViewModel {
  return {
    userId,
    activeObjective: null,
    missionTitle: "Complete setup",
    missionContext: "Add your priorities before adding notes.",
    currentDate: formatDate(),
    headline: "Setup is required before analysis",
    moves: [],
    cooling: undefined,
    missionGap: "Add your setup details to start ranking relationship opportunities.",
    proof: [
      { label: "Today", value: "0", note: "high-leverage moves" },
      { label: "Warm", value: "0", note: "relationships captured" },
      { label: "Blocked", value: "0", note: "waiting on replies" },
    ],
  };
}

export function getDailyBriefViewModel(userId = DEMO_USER_ID): DailyBriefViewModel {
  const objective = activeObjective(userId);
  if (!objective) return emptyBrief(userId);
  const recs = liveRecommendations(userId);
  if (!recs.length) {
    return {
      ...emptyBrief(userId),
      activeObjective: objective,
      missionTitle: missionTitle(objective),
      missionContext: objective.eventContext ?? "Active setup context",
      headline: "No critical relationship moves today",
      missionGap: missionGap(objective),
    };
  }

  const dailyMoves = selectStoredDailyMoves({
    userId,
    objective,
    generatedAt: new Date().toISOString()
  });
  const moves = dailyMoves.map((move) => buildPart5Move(move, userId));
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
    userId,
    activeObjective: objective,
    missionTitle: missionTitle(objective),
    missionContext: objective.eventContext ?? "Active setup context",
    currentDate: formatDate(),
    headline: moves.length
      ? `${moves.length} best move${moves.length === 1 ? "" : "s"} can advance ${missionTitle(objective)}`
      : "No critical relationship moves today",
    moves,
    cooling: coolingMove ? buildPart5Move(coolingMove, userId) : undefined,
    missionGap: missionGap(objective),
    proof: [
      { label: "Today", value: String(moves.length), note: "high-leverage moves" },
      { label: "Warm", value: String(listContacts(userId).length), note: "relationships captured" },
      { label: "Blocked", value: String(sentOrWaiting), note: "waiting on replies" },
    ],
  };
}

function missionGapNode(objective: UserObjectiveProfile): RadarNode {
  return {
    id: "mission-gap",
    name: "Mission gap",
    initials: "MG",
    x: 52,
    y: 18,
    state: "gap",
    note: missionGap(objective),
  };
}

export function getMissionRadarViewModel(userId = DEMO_USER_ID): MissionRadarViewModel {
  const objective = activeObjective(userId);
  if (!objective) {
    return {
      objective: null,
      missionTitle: "Complete setup",
      nodes: [],
      bridges: [],
    };
  }
  const recs = liveRecommendations(userId);
  if (!recs.length) {
    return {
      objective,
      missionTitle: missionTitle(objective),
      nodes: [missionGapNode(objective)],
      bridges: [],
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

  nodes.push(missionGapNode(objective));

  const bridges = scoredMoves
    .filter(
      (move) =>
        move.recommendedAction === "make_intro" ||
        move.scoreBreakdown.missionImpact >= 0.55,
    )
    .slice(0, 3)
    .map((move, index) => {
      return {
        id: `${move.relationshipId}-bridge-${index}`,
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
      : [{ id: "daily-brief-mission-gap", from: "daily brief", to: "mission gap", label: "next relationship signal" }],
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
    note: move.whyNow[0] ?? move.whyThisAction[0] ?? "Picked for you today.",
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

function emptyBoardSections(): BoardSection[] {
  return [
    {
      id: "needs-action",
      title: "Act Today",
      context: "Picked for today",
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
}

export function getRelationshipBoardViewModel(userId = DEMO_USER_ID): RelationshipBoardViewModel {
  const recs = liveRecommendations(userId);
  if (!recs.length) {
    return {
      state: "empty",
      columns: [],
      sections: emptyBoardSections(),
    };
  }

  const sections: BoardSection[] = emptyBoardSections();

  const scoredMoves = scoreStoredRelationshipMoves({
    userId,
    objective: activeObjective(userId) ?? undefined,
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

function emptyPerson(): PersonIntelligenceViewModel {
  return {
    contactId: "",
    state: "empty",
    contact: {
      name: "No contact selected",
      role: "Relationship contact",
      company: "",
      initials: "—",
      location: "Capture a relationship to generate intelligence.",
    },
    warmth: "Medium",
    missionFit: "Weak",
    systemNote: "Nothing saved for this person yet. Add a note to start building their profile.",
    evidence: {
      profile: emptyProfile(),
      sourceLabels: [],
      sources: [],
      sourceCount: 0,
      warnings: [],
      confidence: {
        entityMatch: 0,
        sourceConfidence: 0,
        factConfidence: 0,
        finalConfidence: 0,
      },
    },
    recommendation: {
      title: "No recommendation yet",
      reason: "Add more about this person to get a recommendation.",
      avoid: "Do not contact until the context is clear enough.",
      draft: "No draft has been generated yet.",
      whyNow: [],
      whyThisAction: [],
      whyNot: [],
      whatToAvoid: [],
      risks: [],
      safeFacts: [],
      blockedFacts: [],
      costOfSilence: "Not ranked yet",
    },
  };
}

// Per-opportunity-type labels for the conversion outcomes. The underlying
// OutcomeType values stay fixed; only the surfaced labels (and whether a WTP
// step is relevant) change with the relationship's goal.
const OUTCOME_LABELS_BY_TYPE: Record<
  OpportunityType,
  { booked: string; wtp?: string; paid: string }
> = {
  raise: { booked: "Pitch booked", wtp: "Soft commit", paid: "Committed / invested" },
  hire: { booked: "Interview booked", paid: "Hired / offer out" },
  candidate: { booked: "Interview booked", paid: "Hired / offer out" },
  job: { booked: "Interview booked", paid: "Offer received" },
  user: { booked: "Demo booked", wtp: "They'd pay", paid: "Activated / paid" },
  customer: { booked: "Demo booked", wtp: "They'd pay", paid: "Paid / converted" },
  partner: { booked: "Meeting booked", wtp: "Verbal interest", paid: "Partnership signed" },
  sponsor: { booked: "Meeting booked", wtp: "Verbal interest", paid: "Sponsorship committed" },
  mentor: { booked: "Session booked", paid: "Ongoing mentorship" },
  community: { booked: "Meeting booked", paid: "Joined / committed" },
  other: { booked: "Meeting booked", wtp: "They'd pay", paid: "Converted" },
};

function outcomeLoopOptions(opportunityType?: OpportunityType): OutcomeLoopViewModel["options"] {
  const labels = OUTCOME_LABELS_BY_TYPE[opportunityType ?? "other"];
  const options: OutcomeLoopViewModel["options"] = [
    { id: "reply", label: "Replied", kind: "positive", outcomeType: "reply" },
    { id: "booked", label: labels.booked, kind: "positive", outcomeType: "booked" },
  ];
  if (labels.wtp) {
    options.push({ id: "wtp", label: labels.wtp, kind: "positive", outcomeType: "wtp" });
  }
  options.push(
    { id: "paid", label: labels.paid, kind: "positive", outcomeType: "paid" },
    { id: "not-relevant", label: "Not relevant", kind: "negative", outcomeType: "marked_not_relevant" },
    { id: "no-response", label: "No response", kind: "neutral", outcomeType: "ignored" },
  );
  return options;
}

function emptyOutcomeLoop(userId: Id): OutcomeLoopViewModel {
  return {
    state: "empty",
    summary: tractionSummary(userId),
    contact: {
      name: "No move to log",
      role: "Outcome loop",
      company: "",
      initials: "—",
      location: "Capture a relationship and act on a recommendation to start the loop.",
    },
    prompt: "Nothing to log yet",
    options: outcomeLoopOptions(),
  };
}

interface EvidenceSource {
  sourceName: string;
  sourceUrl?: string;
  provenance: EvidenceProvenance;
  sourceLabel: string;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return dedupeStrings(value.filter((item): item is string => typeof item === "string"));
}

function emptyProfile(): EvidenceProfile {
  return { summary: "", expertise: [], highlights: [], signals: [] };
}

/** The cohesive profile synthesized at enrichment time, if one was persisted. */
function readStoredProfile(contactId: Id): EvidenceProfile | null {
  for (const ctx of listPublicContext(contactId)) {
    const raw = ctx.rawContext;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const profile = (raw as Record<string, unknown>).profile;
    if (profile && typeof profile === "object" && !Array.isArray(profile)) {
      const record = profile as Record<string, unknown>;
      return {
        summary: tidyFact(asString(record.summary) ?? "", 320),
        role: asString(record.role),
        company: asString(record.company),
        sector: asString(record.sector),
        location: asString(record.location),
        expertise: tidyFacts(asStringArray(record.expertise), { max: 8, maxLength: 60 }),
        highlights: tidyFacts(asStringArray(record.highlights), { max: 8 }),
        signals: tidyFacts(asStringArray(record.signals), { max: 6 }),
      };
    }
  }
  return null;
}

/** Deterministic merge of the raw facts into one structure — used when no LLM
 *  synthesis was persisted, so the screen still shows a single cohesive card. */
function deterministicProfile(
  facts: Array<{ text: string; factConfidence: number }>,
  contact: { role?: string | null; company?: string | null },
): EvidenceProfile {
  const ordered = [...facts].sort((left, right) => right.factConfidence - left.factConfidence);
  const highlights = tidyFacts(ordered.map((fact) => fact.text), { max: 8 });
  return {
    summary: highlights[0] ?? "",
    role: contact.role ?? undefined,
    company: contact.company ?? undefined,
    expertise: [],
    highlights,
    signals: [],
  };
}

function dedupeSources(sources: EvidenceSource[]): EvidenceSource[] {
  const seen = new Set<string>();
  const out: EvidenceSource[] = [];
  for (const source of sources) {
    const key = `${source.sourceName}::${source.sourceUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
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

  if (!contact) return emptyPerson();

  const rec =
    selectedRec ??
    recs.find((candidate) => candidate.contactId === contact.id);
  const draft: Draft | null = rec ? getDraftForRecommendation(rec.id) : null;
  const move = scoreStoredRelationshipMoves({
    userId,
    objective: activeObjective(userId) ?? undefined,
    generatedAt: new Date().toISOString()
  }).find((candidate) => candidate.contactId === contact.id);
  const evidenceFacts = listEvidenceFacts(contact.id)
    .sort((left, right) => right.factConfidence - left.factConfidence)
    .slice(0, 5);
  const sourceRecords = listSourceRecords(contact.id);
  const sourceCount = sourceRecords.length;
  const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
  const confidence = rec?.explanation.confidenceBreakdown;
  const safeFacts = rec?.explanation.safeFactsUsed ?? [];
  const facts = evidenceFacts.map((fact) => {
    const source = fact.sourceRecordId ? sourceById.get(fact.sourceRecordId) : undefined;
    const sourceType = source?.sourceType ?? fact.sourceType;
    const sourceUrl = source?.sourceUrl ?? undefined;
    return {
      id: fact.id,
      text: fact.fact,
      factConfidence: fact.factConfidence,
      safeForDraft: fact.safeForDraft,
      sourceName: source?.sourceName ?? "Unknown source",
      sourceUrl,
      sourceType,
      ...evidenceProvenance({ sourceType, sourceUrl })
    };
  });

  const company = contact.company ?? "Unknown company";
  const role = contact.role ?? "Relationship contact";

  const sources = dedupeSources(
    facts.map((fact) => ({
      sourceName: fact.sourceName,
      sourceUrl: fact.sourceUrl,
      provenance: fact.provenance,
      sourceLabel: fact.sourceLabel,
    })),
  );
  const sourceLabels = Array.from(new Set(sources.map((source) => source.sourceLabel)));
  const profile =
    readStoredProfile(contact.id) ??
    deterministicProfile(facts, { role: contact.role, company: contact.company });

  return {
    contactId: contact.id,
    state: "ready",
    contact: {
      name: contact.name ?? "Unknown contact",
      role,
      company,
      initials: initials(contact.name),
      location: contact.website ?? contact.linkedinUrl ?? "Captured from conversation",
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      website: contact.website ?? undefined,
      linkedinUrl: contact.linkedinUrl ?? undefined,
    },
    warmth: warmthLabel(rec),
    missionFit: missionFitLabel(confidence?.userGoalFit ?? 0.5),
    systemNote: move
      ? `${costOfSilenceLabel(move)}. ${move.whyNow[0] ?? "Chosen for you today."}`
      : rec
        ? `${facts.length || safeFacts.length} usable fact${facts.length === 1 ? "" : "s"} and ${sourceCount} public source${sourceCount === 1 ? "" : "s"} inform this recommendation.`
      : "Ready for a recommendation once we know a bit more.",
    evidence: {
      profile,
      sourceLabels,
      sources,
      sourceCount,
      warnings: friendlyWarnings(rec?.explanation.warnings ?? []),
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
      actionKey: move?.recommendedAction ?? (rec?.recommendedAction === "CONFIRM_DETAILS" ? "confirm_details" : undefined),
      title: move
        ? `Best move today: ${relationshipActionLabel(move.recommendedAction).toLowerCase()}`
        : rec
          ? `Best move today: ${formatAction(rec.recommendedAction).toLowerCase()}`
          : "No recommendation yet",
      reason: move ? move.whyThisAction[0] ?? move.whyNow[0] : rec ? firstReason(rec) : "Add more about this person to get a recommendation.",
      avoid: move ? move.whatToAvoid[0] ?? "Keep the final action user-controlled." : rec ? firstAvoidance(rec) : "Do not contact until the context is clear enough.",
      draft: draft?.body ?? "No draft has been generated for this recommendation yet.",
      whyNow: move?.whyNow ?? [],
      whyThisAction: move?.whyThisAction ?? [],
      whyNot: move?.whyNot ?? [],
      whatToAvoid: move?.whatToAvoid ?? (rec ? [firstAvoidance(rec)] : []),
      risks: move?.risks ?? [],
      safeFacts: tidyFacts(move?.safeFactsForDraft ?? safeFacts),
      blockedFacts: tidyFacts(move?.blockedFacts ?? []),
      costOfSilence: move ? costOfSilenceLabel(move) : "Not ranked yet",
    },
  };
}

export function getOutcomeLoopViewModel(userId = DEMO_USER_ID): OutcomeLoopViewModel {
  const recs = liveRecommendations(userId);
  const target =
    recs.find((rec) => rec.status === "pending" || rec.status === "sent") ??
    recs[0];
  if (!target) return emptyOutcomeLoop(userId);

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
    options: outcomeLoopOptions(target.explanation.chosenRoute.type),
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
