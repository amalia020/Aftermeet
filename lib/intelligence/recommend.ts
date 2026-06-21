/**
 * Part 3 public service — the decision-and-action orchestrator.
 *
 * `recommendNextAction` is the function the Part 1 process route calls. It takes
 * the Part 2 EvidenceBundle plus the user objective and runs the deterministic
 * pipeline:
 *
 *   inferUserCluster -> classifyContactCluster -> scoreOpportunityRoutes
 *   -> recipientBurden -> warmthScore -> opportunityPriority -> chooseAction
 *   -> buildDecisionTrace -> (if action implies a message) generateDraft
 *   -> assemble ActionRecommendation + FollowUpBoardCard -> RecommendationPackage
 *
 * It persists routes, the recommendation, and the draft via the db queries. On
 * any unexpected error it returns the saved demo package with a warning. It
 * never throws. Server-only because draft generation may call a provider.
 */

import "server-only";
import { clamp01, deterministicId, mean } from "@/lib/utils";
import {
  saveDraftForUser,
  saveOpportunityRoutesForUser,
  saveRecommendationForUser,
} from "@/lib/db/store";
import { part3DemoRecommendationPackage } from "@/lib/demo/fixtures";
import { inferUserCluster } from "./userObjective";
import { classifyContactCluster } from "./clustering";
import { scoreOpportunityRoutes } from "./opportunityRouting";
import { recipientBurden } from "./recipientBurden";
import { warmthScore } from "./warmthDecay";
import { opportunityPriority } from "./scoring";
import { actionForOpportunity, actionImpliesMessage, chooseAction } from "./actionPolicy";
import { factsAllowedInDraft } from "./draftPolicy";
import { generateDraft } from "./draftGeneration";
import { buildDecisionTrace } from "./decisionTrace";
import { feedbackBoost } from "./feedbackLearning";
import type {
  ActionRecommendation,
  Contact,
  ContactStatus,
  ConversationAtoms,
  DecisionTrace,
  EvidenceBundle,
  EvidenceFact,
  FollowUpBoardCard,
  OpportunityRoute,
  OutcomeSummary,
  RecommendationPackage,
  UserObjectiveProfile,
} from "@/lib/types";

interface RecommendInput {
  evidenceBundle: EvidenceBundle;
  objective: UserObjectiveProfile;
  status?: ContactStatus;
  hoursSinceLastAction?: number;
  outcomes?: OutcomeSummary[];
  now?: Date;
}

/** Build a synthetic atoms object: the bundle carries facts, not raw atoms. */
function atomsFromBundle(bundle: EvidenceBundle): ConversationAtoms {
  return {
    facts: bundle.evidenceFacts.map((f) => ({
      text: f.fact,
      type: f.factType ?? undefined,
      confidence: f.factConfidence,
      isProfessional: f.isProfessional,
      isSensitive: f.isSensitive,
    })),
    asks: [],
    offers: [],
    commitments: [],
    uncertainties: bundle.enrichment.warnings,
    sentiment: undefined,
    extractionConfidence: bundle.evidenceFacts.length
      ? clamp01(mean(bundle.evidenceFacts.map((f) => f.extractionConfidence)))
      : 0.5,
  };
}

function contactFromBundle(bundle: EvidenceBundle, objective: UserObjectiveProfile): Contact {
  const c = bundle.contactCandidate;
  const nowIso = new Date().toISOString();
  return {
    id: bundle.contactId ?? deterministicId("contact", bundle.conversationId),
    userId: objective.userId,
    name: c.name ?? null,
    role: c.role ?? null,
    company: c.company ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    website: c.website ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    sourceType: "manual",
    entityMatchConfidence: bundle.entityResolution.score,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function stakesForRoute(routeType: OpportunityRoute["type"]): number {
  // Higher-stakes relationship paths get more weight in priority.
  const map: Partial<Record<OpportunityRoute["type"], number>> = {
    raise: 0.9,
    customer: 0.8,
    sponsor: 0.8,
    partner: 0.7,
    user: 0.7,
    hire: 0.7,
    candidate: 0.6,
    mentor: 0.5,
    job: 0.6,
    community: 0.4,
    other: 0.3,
  };
  return map[routeType] ?? 0.5;
}

export async function recommendNextAction(
  input: RecommendInput,
): Promise<RecommendationPackage> {
  try {
    const { evidenceBundle: bundle, objective } = input;
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const status: ContactStatus = input.status ?? "new";
    const hoursSinceLastAction = input.hoursSinceLastAction ?? 0;
    const outcomes = input.outcomes ?? [];
    const warnings: string[] = [...bundle.enrichment.warnings];

    const contact = contactFromBundle(bundle, objective);
    const atoms = atomsFromBundle(bundle);
    const facts: EvidenceFact[] = bundle.evidenceFacts;

    // --- Clustering ---
    const userCluster = inferUserCluster({ objective, outcomes });
    const contactCluster = classifyContactCluster({
      contact,
      atoms,
      publicContext: bundle.publicContext,
    });

    // --- Opportunity routes ---
    const routes = scoreOpportunityRoutes({
      userCluster,
      contactCluster,
      atoms,
      facts,
      objective,
      contactId: contact.id,
      conversationId: bundle.conversationId,
      now,
    });
    const chosenRoute: OpportunityRoute = routes[0] ?? {
      type: "other",
      score: 0,
      evidence: [],
      why: [],
      whyNot: [],
      contactId: contact.id,
      conversationId: bundle.conversationId,
      createdAt: nowIso,
    };

    // --- Derive scoring inputs ---
    const entityMatchConfidence = clamp01(bundle.entityResolution.score);
    const factConfidence = facts.length
      ? clamp01(mean(facts.map((f) => f.factConfidence)))
      : 0.5;
    const sourceConfidence = bundle.sourceRecords.length
      ? clamp01(mean(bundle.sourceRecords.map((s) => s.sourceConfidence)))
      : 0.3;

    const explicitCommitment = atoms.commitments.some(
      (c) => (c.explicitness ?? 0) >= 0.5,
    )
      ? 1
      : facts.some((f) => f.factType === "intent")
        ? 0.7
        : 0;

    const mutualValue = clamp01(
      Math.max(
        contactCluster.potentialUser,
        contactCluster.partner,
        contactCluster.sponsor,
      ),
    );
    const relationshipStrength = clamp01(0.2 + 0.5 * entityMatchConfidence);
    const messageSpecificity = clamp01(0.4 + 0.6 * factConfidence);
    const askSize = chosenRoute.type === "raise" ? 0.8 : 0.4;
    const timingFit = clamp01(
      warmthScore({
        opportunityType: chosenRoute.type,
        hoursSinceLastAction,
        status,
      }),
    );

    // --- Recipient burden ---
    const burden = recipientBurden({
      messageSpecificity,
      askSize,
      relationshipStrength,
      mutualValue,
      timingFit,
    });

    // --- Warmth / urgency ---
    const urgencyScore = warmthScore({
      opportunityType: chosenRoute.type,
      hoursSinceLastAction,
      status,
    });

    // --- Priority ---
    const userGoalFit = clamp01(chosenRoute.score);
    const contactPovFit = mutualValue;
    const uncertaintyPenalty = clamp01(
      0.5 * (1 - entityMatchConfidence) + 0.5 * (atoms.uncertainties.length > 0 ? 0.5 : 0),
    );
    const boost = feedbackBoost({ opportunityType: chosenRoute.type, outcomes });
    const priorityScore = clamp01(
      opportunityPriority({
        userGoalFit,
        contactPovFit,
        stakes: stakesForRoute(chosenRoute.type),
        urgencyDecay: urgencyScore,
        explicitCommitment,
        factConfidence,
        relationshipStrength,
        recipientBurden: burden,
        uncertaintyPenalty,
      }) + boost,
    );

    // --- Action policy ---
    const action = chooseAction({
      status,
      entityMatchConfidence,
      recipientBurden: burden,
      priorityScore,
      urgencyScore,
      topOpportunityRoute: chosenRoute,
      hasExplicitCommitment: explicitCommitment >= 0.7,
    });

    // --- Confidence breakdown ---
    const finalConfidence = clamp01(
      0.3 * entityMatchConfidence +
        0.25 * factConfidence +
        0.15 * sourceConfidence +
        0.15 * userGoalFit +
        0.15 * contactPovFit -
        0.1 * burden,
    );

    if (entityMatchConfidence < 0.45) {
      warnings.push("Entity match is low — details require confirmation.");
    }
    if (facts.length === 0) {
      warnings.push("No evidence facts available — recommendation is conservative.");
    }

    const confidenceBreakdown: DecisionTrace["confidenceBreakdown"] = {
      entityMatch: entityMatchConfidence,
      sourceConfidence,
      factConfidence,
      userGoalFit,
      contactPovFit,
      recipientBurden: burden,
      finalConfidence,
    };

    // --- Draft gate + generation (only for message-implying actions) ---
    const safeFacts = factsAllowedInDraft(facts);
    const recommendationId = deterministicId(
      "rec",
      `${contact.id}:${bundle.conversationId}`,
    );

    let draft = undefined as RecommendationPackage["draft"];
    if (actionImpliesMessage(action)) {
      if (safeFacts.length === 0) {
        warnings.push("No safe facts available for a draft — showing recommendation only.");
      } else {
        draft = await generateDraft({
          recommendationId,
          contactId: contact.id,
          objective,
          contact,
          action,
          factsAllowedInDraft: safeFacts,
          whyThis: chosenRoute.why,
          recipientBurden: burden,
          tone: objective.preferredTone,
          now,
        });
      }
    }

    // --- Decision trace ---
    const inputSummary = [
      contact.name ? `Met ${contact.name}` : "Met a contact",
      contact.company ? `(${contact.company})` : "",
      objective.eventContext ? `at ${objective.eventContext}.` : ".",
    ]
      .filter(Boolean)
      .join(" ");

    const decisionTrace = buildDecisionTrace({
      inputSummary,
      atoms,
      evidenceBundle: bundle,
      routes,
      chosenRoute,
      chosenAction: action,
      confidenceBreakdown,
      safeFactsUsed: safeFacts.map((f) => f.fact),
      warnings,
    });

    // --- Assemble recommendation ---
    const recommendation: ActionRecommendation = {
      id: recommendationId,
      userId: objective.userId,
      contactId: contact.id,
      conversationId: bundle.conversationId,
      recommendedAction: action,
      priorityScore,
      urgencyScore,
      recipientBurden: burden,
      confidence: finalConfidence,
      status: "pending",
      explanation: decisionTrace,
      createdAt: nowIso,
    };

    // --- Board card ---
    const warmth = warmthScore({
      opportunityType: chosenRoute.type,
      hoursSinceLastAction,
      status,
    });
    const stakes = stakesForRoute(chosenRoute.type);
    const staleness = clamp01(1 - warmth);
    const warning =
      status !== "booked" &&
      status !== "archived" &&
      stakes * staleness >= 0.45 &&
      priorityScore >= 0.4;
    const boardCard: FollowUpBoardCard = {
      contactId: contact.id,
      recommendationId,
      contactName: contact.name,
      company: contact.company,
      status,
      recommendedAction: action,
      priorityScore,
      urgencyScore,
      warmthScore: warmth,
      warning,
      warningReason: warning ? "High stakes and the thread is going cold." : undefined,
      updatedAt: nowIso,
    };

    // --- Persist ---
    try {
      await saveOpportunityRoutesForUser(routes, input.evidenceBundle.userId);
      await saveRecommendationForUser(recommendation);
      if (draft) await saveDraftForUser(draft, input.evidenceBundle.userId);
    } catch {
      warnings.push("Persistence unavailable — recommendation computed in-memory only.");
    }

    return {
      recommendation,
      routes,
      decisionTrace,
      draft,
      boardCard,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...part3DemoRecommendationPackage,
      warnings: [
        ...part3DemoRecommendationPackage.warnings,
        `Recommendation engine fell back to demo package: ${message}`,
      ],
    };
  }
}

// Re-export the action mapping for callers/tests that want the route→action map.
export { actionForOpportunity };
