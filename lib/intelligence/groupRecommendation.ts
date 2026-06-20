/**
 * Phase 19 — Cluster / group recommendation.
 *
 * Recommends which *types* of people the user should prioritize next, based on
 * goal fit, coverage gaps, expected signal, accessibility, urgency, and
 * confidence. Recommends groups (clusters), never marketplace profiles.
 *
 * Pure and deterministic.
 */

import { clamp01 } from "@/lib/utils";
import { conversionRatesForType } from "./feedbackLearning";
import type {
  ClusterRecommendation,
  ContactClusterSummary,
  OpportunityType,
  OutcomeSummary,
  UserGoal,
  UserObjectiveProfile,
} from "@/lib/types";

/** Candidate clusters the engine can recommend, with goal alignment + access. */
interface ClusterCandidate {
  name: string;
  opportunityType: OpportunityType;
  goals: UserGoal[];
  accessibility: number;
  suggestedAction: string;
  expectedSignal: string;
}

const CANDIDATES: ClusterCandidate[] = [
  {
    name: "Target-ICP users (founders/operators who attend many events)",
    opportunityType: "user",
    goals: ["find_users", "find_design_partners", "collect_wtp"],
    accessibility: 0.8,
    suggestedAction: "Offer early access and ask for a paid reuse signal.",
    expectedSignal: "Product interest, WTP signal.",
  },
  {
    name: "Aligned investors",
    opportunityType: "raise",
    goals: ["raise", "find_investments"],
    accessibility: 0.5,
    suggestedAction: "Share a concise update and ask for a follow-up meeting.",
    expectedSignal: "Meeting booked.",
  },
  {
    name: "Potential partners",
    opportunityType: "partner",
    goals: ["find_partners", "build_community"],
    accessibility: 0.6,
    suggestedAction: "Propose a concrete, small pilot.",
    expectedSignal: "Pilot interest.",
  },
  {
    name: "Mentors / advisors",
    opportunityType: "mentor",
    goals: ["find_mentors", "learn"],
    accessibility: 0.7,
    suggestedAction: "Ask one sharp, specific question.",
    expectedSignal: "Reply with guidance.",
  },
  {
    name: "Candidates",
    opportunityType: "candidate",
    goals: ["hire", "source_candidates"],
    accessibility: 0.6,
    suggestedAction: "Open a low-pressure conversation about the role.",
    expectedSignal: "Interest in interviewing.",
  },
  {
    name: "Customers / sponsors",
    opportunityType: "customer",
    goals: ["find_customers", "collect_wtp"],
    accessibility: 0.55,
    suggestedAction: "Ask for a small paid commitment or WTP signal.",
    expectedSignal: "Paid / WTP signal.",
  },
];

function goalFitFor(
  candidate: ClusterCandidate,
  objective: UserObjectiveProfile,
): number {
  if (candidate.goals.includes(objective.primaryGoal)) return 1;
  if (candidate.goals.some((g) => objective.secondaryGoals?.includes(g))) return 0.6;
  if (candidate.goals.some((g) => objective.activeGoals?.includes(g))) return 0.4;
  return 0.1;
}

function coverageGapFor(
  candidate: ClusterCandidate,
  current: ContactClusterSummary[],
): number {
  // Gap is large when there are few existing contacts in a matching cluster.
  const matching = current.find((c) =>
    c.clusterName.toLowerCase().includes(candidate.opportunityType),
  );
  const count = matching?.count ?? 0;
  // 0 contacts → gap 1; saturates around 5 contacts → gap ~0.
  return clamp01(1 - count / 5);
}

export function recommendNextCluster(input: {
  userObjective: UserObjectiveProfile;
  currentClusters: ContactClusterSummary[];
  outcomes: OutcomeSummary[];
  attentionBudget: number;
}): ClusterRecommendation[] {
  if (input.attentionBudget <= 0) return [];

  const recommendations: ClusterRecommendation[] = CANDIDATES.map((candidate) => {
    const goalFit = goalFitFor(candidate, input.userObjective);
    const coverageGap = coverageGapFor(candidate, input.currentClusters);
    const rates = conversionRatesForType(candidate.opportunityType, input.outcomes);
    const expectedSignal = clamp01(
      rates.total > 0
        ? 0.4 * rates.replyRate + 0.3 * rates.bookingRate + 0.3 * rates.paidRate + 0.3
        : 0.5,
    );
    const accessibility = candidate.accessibility;
    const urgency = clamp01(0.4 + 0.6 * coverageGap);
    const confidence = clamp01(rates.total > 0 ? 0.6 + 0.1 * rates.total : 0.5);

    const score = clamp01(
      0.25 * goalFit +
        0.25 * coverageGap +
        0.2 * expectedSignal +
        0.1 * accessibility +
        0.1 * urgency +
        0.1 * confidence,
    );

    const why: string[] = [];
    if (goalFit >= 0.6) why.push("Directly serves your active goal.");
    if (coverageGap >= 0.6) why.push("You have little coverage in this cluster.");
    if (rates.total > 0 && rates.replyRate >= 0.3) {
      why.push("This cluster has been converting well for you.");
    }
    if (why.length === 0) why.push("Adds balance to your opportunity portfolio.");

    return {
      clusterName: candidate.name,
      score,
      why,
      suggestedAction: candidate.suggestedAction,
      expectedSignal: candidate.expectedSignal,
      confidence,
    } satisfies ClusterRecommendation;
  });

  recommendations.sort((a, b) => b.score - a.score);

  // Only return meaningful recommendations; can be empty if nothing is relevant.
  return recommendations.filter((r) => r.score >= 0.3).slice(0, 3);
}
