/**
 * Phase 10 — Opportunity routing.
 *
 * Generates multi-label opportunity routes by combining the user cluster, the
 * contact cluster, conversation atoms, evidence facts, and any opportunity hints
 * from extraction. Each route is scored against the user objective (a route only
 * matters as much as the user cares about that kind of relationship) and the
 * contact's POV fit. The top route is chosen by the caller, but suppressed
 * routes are retained with `why`/`whyNot` so the UI can show the five-fork view.
 *
 * Pure and deterministic.
 */

import { clamp01, deterministicId, mean } from "@/lib/utils";
import type {
  ContactClusterScores,
  ConversationAtoms,
  EvidenceFact,
  OpportunityHint,
  OpportunityRoute,
  OpportunityType,
  UserClusterScores,
  UserObjectiveProfile,
} from "@/lib/types";

/** Which user cluster a route serves, and which contact cluster supports it. */
interface RouteMapping {
  type: OpportunityType;
  userCluster: keyof UserClusterScores;
  contactCluster: keyof ContactClusterScores;
  label: string;
}

const ROUTE_MAP: RouteMapping[] = [
  { type: "user", userCluster: "userDiscovery", contactCluster: "potentialUser", label: "potential user" },
  { type: "raise", userCluster: "fundraising", contactCluster: "investor", label: "investor / fundraising" },
  { type: "partner", userCluster: "partnerships", contactCluster: "partner", label: "partner" },
  { type: "mentor", userCluster: "mentorship", contactCluster: "mentor", label: "mentor" },
  { type: "candidate", userCluster: "recruiting", contactCluster: "potentialHire", label: "candidate" },
  { type: "hire", userCluster: "hiring", contactCluster: "potentialHire", label: "hire" },
  { type: "customer", userCluster: "sponsorBd", contactCluster: "sponsor", label: "customer" },
  { type: "sponsor", userCluster: "sponsorBd", contactCluster: "sponsor", label: "sponsor" },
  { type: "job", userCluster: "jobSeeking", contactCluster: "recruiter", label: "job opportunity" },
];

function averageFactConfidence(facts: EvidenceFact[]): number {
  if (facts.length === 0) return 0.5;
  return clamp01(mean(facts.map((f) => f.factConfidence)));
}

function hasExplicitCommitment(atoms: ConversationAtoms): boolean {
  return (atoms.commitments ?? []).some((c) => (c.explicitness ?? 0) >= 0.5);
}

export function scoreOpportunityRoutes(input: {
  userCluster: UserClusterScores;
  contactCluster: ContactClusterScores;
  atoms: ConversationAtoms;
  facts: EvidenceFact[];
  objective: UserObjectiveProfile;
  hints?: OpportunityHint[];
  contactId?: string;
  conversationId?: string;
  now?: Date;
}): OpportunityRoute[] {
  const {
    userCluster,
    contactCluster,
    atoms,
    facts,
    hints = [],
    contactId,
    conversationId,
  } = input;

  const nowIso = (input.now ?? new Date()).toISOString();
  const factConfidence = averageFactConfidence(facts);
  const commitment = hasExplicitCommitment(atoms);
  const hintByType = new Map<OpportunityType, OpportunityHint>();
  for (const hint of hints) hintByType.set(hint.route, hint);

  const routes: OpportunityRoute[] = ROUTE_MAP.map((mapping) => {
    const goalFit = clamp01(userCluster[mapping.userCluster] ?? 0);
    const povFit = clamp01(contactCluster[mapping.contactCluster] ?? 0);
    const hint = hintByType.get(mapping.type);
    const hintScore = hint ? clamp01(hint.score) : 0;

    // Route score: a route is strong when the user cares about it AND the
    // contact fits it, lifted by any extraction hint, scaled by fact confidence.
    const rawScore =
      0.4 * goalFit +
      0.35 * povFit +
      0.15 * hintScore +
      0.1 * factConfidence;
    const score = clamp01(rawScore);

    const evidence: string[] = [];
    if (hint) evidence.push(...hint.evidence);
    if (povFit >= 0.5) evidence.push(`Contact profile fits ${mapping.label}.`);

    const why: string[] = [];
    const whyNot: string[] = [];

    if (goalFit >= 0.5) why.push(`Matches your goal (${mapping.label}).`);
    else whyNot.push(`Not a priority for your current objective.`);

    if (povFit >= 0.5) why.push(`Contact looks like a ${mapping.label}.`);
    else whyNot.push(`Weak evidence the contact is a ${mapping.label}.`);

    if (commitment && mapping.type === "user") {
      why.push("Explicit commitment / product interest in the conversation.");
    }
    if (mapping.type === "raise" && povFit < 0.4) {
      whyNot.push("Not an investor conversation, so do not send a deck.");
    }
    if (mapping.type === "partner" && povFit < 0.4) {
      whyNot.push("No concrete partner pilot discussed, so do not pitch partnership yet.");
    }
    if (mapping.type === "mentor" && goalFit < 0.4) {
      whyNot.push("No mentor ask needed yet.");
    }

    return {
      id: deterministicId("route", `${contactId ?? "c"}:${mapping.type}`),
      contactId,
      conversationId,
      type: mapping.type,
      score,
      evidence,
      why,
      whyNot,
      createdAt: nowIso,
    } satisfies OpportunityRoute;
  });

  // Sort descending so callers can pick the top route directly.
  routes.sort((a, b) => b.score - a.score);
  return routes;
}
