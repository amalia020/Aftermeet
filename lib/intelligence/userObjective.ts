/**
 * Phase 9 — User clustering.
 *
 * Maps the user's active objective (role + goals) into multi-label
 * `UserClusterScores`. The user can belong to several modes at once (e.g. a
 * founder who is both fundraising and looking for users), so this never forces
 * a single label. Recent outcomes nudge the scores slightly.
 *
 * Pure and deterministic — no I/O, no clock reads beyond injected data.
 */

import { clamp01 } from "@/lib/utils";
import type {
  ConversationSummary,
  OutcomeSummary,
  UserClusterScores,
  UserGoal,
  UserObjectiveProfile,
  UserRole,
} from "@/lib/types";

type ClusterKey = keyof UserClusterScores;

const EMPTY_SCORES: UserClusterScores = {
  fundraising: 0,
  hiring: 0,
  userDiscovery: 0,
  partnerships: 0,
  mentorship: 0,
  recruiting: 0,
  jobSeeking: 0,
  sponsorBd: 0,
};

/** A user goal contributes weight to one or more clusters. */
const GOAL_WEIGHTS: Record<UserGoal, Partial<Record<ClusterKey, number>>> = {
  raise: { fundraising: 1 },
  hire: { hiring: 1 },
  find_users: { userDiscovery: 1 },
  find_design_partners: { userDiscovery: 0.6, partnerships: 0.6 },
  find_mentors: { mentorship: 1 },
  find_investments: { fundraising: 0.3, partnerships: 0.3 },
  source_candidates: { recruiting: 1 },
  find_customers: { sponsorBd: 0.7, userDiscovery: 0.4 },
  find_partners: { partnerships: 1 },
  find_job_opportunities: { jobSeeking: 1 },
  build_community: { partnerships: 0.5, mentorship: 0.3 },
  win_hackathon: { partnerships: 0.4 },
  collect_wtp: { userDiscovery: 0.5, sponsorBd: 0.5 },
  learn: { mentorship: 0.7 },
  other: {},
};

/** A role provides a soft prior over clusters. */
const ROLE_WEIGHTS: Record<UserRole, Partial<Record<ClusterKey, number>>> = {
  founder: { fundraising: 0.3, userDiscovery: 0.4, partnerships: 0.2 },
  operator: { partnerships: 0.3, userDiscovery: 0.3, hiring: 0.2 },
  investor: { fundraising: 0.2, partnerships: 0.3 },
  recruiter: { recruiting: 0.6 },
  student: { mentorship: 0.5, jobSeeking: 0.4 },
  job_seeker: { jobSeeking: 0.7 },
  sponsor_bd: { sponsorBd: 0.6, partnerships: 0.3 },
  sales: { sponsorBd: 0.5, partnerships: 0.2 },
  community_builder: { partnerships: 0.4, mentorship: 0.3 },
  other: {},
};

/** Map an outcome's opportunity type onto a cluster for small reinforcement. */
const OUTCOME_TYPE_TO_CLUSTER: Partial<Record<string, ClusterKey>> = {
  raise: "fundraising",
  hire: "hiring",
  user: "userDiscovery",
  partner: "partnerships",
  mentor: "mentorship",
  candidate: "recruiting",
  customer: "sponsorBd",
  sponsor: "sponsorBd",
  job: "jobSeeking",
};

function applyWeights(
  scores: UserClusterScores,
  weights: Partial<Record<ClusterKey, number>>,
  factor: number,
): void {
  for (const key of Object.keys(weights) as ClusterKey[]) {
    scores[key] += (weights[key] ?? 0) * factor;
  }
}

/**
 * Infer the multi-label user cluster scores from an objective profile, recent
 * conversations, and outcomes.
 */
export function inferUserCluster(input: {
  objective: UserObjectiveProfile;
  recentConversations?: ConversationSummary[];
  outcomes?: OutcomeSummary[];
}): UserClusterScores {
  const { objective } = input;
  const scores: UserClusterScores = { ...EMPTY_SCORES };

  // Role prior.
  applyWeights(scores, ROLE_WEIGHTS[objective.role] ?? {}, 1);

  // Primary goal dominates, secondary goals contribute less.
  applyWeights(scores, GOAL_WEIGHTS[objective.primaryGoal] ?? {}, 1.5);
  for (const goal of objective.secondaryGoals ?? []) {
    applyWeights(scores, GOAL_WEIGHTS[goal] ?? {}, 0.6);
  }
  // activeGoals that are not already primary/secondary still count a little.
  const counted = new Set<UserGoal>([
    objective.primaryGoal,
    ...(objective.secondaryGoals ?? []),
  ]);
  for (const goal of objective.activeGoals ?? []) {
    if (!counted.has(goal)) applyWeights(scores, GOAL_WEIGHTS[goal] ?? {}, 0.4);
  }

  // Small outcome-based reinforcement (does not overfit on one event).
  const outcomes = input.outcomes ?? [];
  for (const outcome of outcomes) {
    if (!outcome.opportunityType) continue;
    const cluster = OUTCOME_TYPE_TO_CLUSTER[outcome.opportunityType];
    if (cluster) scores[cluster] += 0.05;
  }

  // Normalize so the dominant cluster is 1.0 while preserving multi-label shape.
  const max = Math.max(...Object.values(scores));
  if (max > 0) {
    for (const key of Object.keys(scores) as ClusterKey[]) {
      scores[key] = clamp01(scores[key] / max);
    }
  }

  return scores;
}
