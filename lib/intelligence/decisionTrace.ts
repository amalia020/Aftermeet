/**
 * Phase 17 — Decision trace.
 *
 * Assembles the human-readable explanation of how the engine moved from a messy
 * conversation to a chosen action: input summary, extracted facts, retrieved
 * context, route scores, the chosen route/action, why this action, why not the
 * others, a confidence breakdown, the safe facts used, and warnings.
 *
 * Pure and deterministic.
 */

import type {
  ConversationAtoms,
  DecisionTrace,
  EvidenceBundle,
  OpportunityRoute,
  RecommendedActionType,
} from "@/lib/types";

function summarizeContext(bundle: EvidenceBundle): string[] {
  const lines: string[] = [];
  for (const ctx of bundle.publicContext) {
    const name = ctx.canonicalName ?? "entity";
    lines.push(`${ctx.provider}: ${name} (${ctx.entityType}).`);
  }
  if (bundle.enrichment.status === "public_context_unavailable") {
    lines.push("Public context unavailable.");
  }
  return lines;
}

/** Build the "why this action" lines, drawing on the chosen route. */
function whyThisFor(
  action: RecommendedActionType,
  chosenRoute: OpportunityRoute,
): string[] {
  const lines = [...chosenRoute.why];
  switch (action) {
    case "CONFIRM_DETAILS":
      lines.unshift("We're not sure this is the right person — confirm before reaching out.");
      break;
    case "DO_NOT_CONTACT":
      lines.unshift("Reaching out now might feel pushy — give it a little time.");
      break;
    case "STAY_CALM":
      lines.unshift("Priority is low — no action needed right now.");
      break;
    case "WAIT":
      lines.unshift("Not enough to go on yet — wait for a clearer moment.");
      break;
    case "REPLY_NOW":
      lines.unshift("They replied — respond now before warmth decays.");
      break;
    default:
      break;
  }
  return lines.length > 0 ? lines : [`Recommended: ${action}.`];
}

/** Collect why-not lines from the suppressed routes. */
function whyNotFor(
  routes: OpportunityRoute[],
  chosenRoute: OpportunityRoute,
): string[] {
  const lines: string[] = [];
  for (const route of routes) {
    if (route.type === chosenRoute.type) continue;
    for (const reason of route.whyNot) {
      if (!lines.includes(reason)) lines.push(reason);
    }
  }
  return lines;
}

export function buildDecisionTrace(input: {
  inputSummary: string;
  atoms: ConversationAtoms;
  evidenceBundle: EvidenceBundle;
  routes: OpportunityRoute[];
  chosenRoute: OpportunityRoute;
  chosenAction: RecommendedActionType;
  confidenceBreakdown: DecisionTrace["confidenceBreakdown"];
  safeFactsUsed: string[];
  warnings: string[];
}): DecisionTrace {
  const extractedFacts = (input.atoms.facts ?? []).map((f) => f.text);
  const retrievedContext = summarizeContext(input.evidenceBundle);

  return {
    inputSummary: input.inputSummary,
    extractedFacts,
    retrievedContext,
    routeScores: input.routes,
    chosenRoute: input.chosenRoute,
    chosenAction: input.chosenAction,
    whyThisAction: whyThisFor(input.chosenAction, input.chosenRoute),
    whyNotOtherActions: whyNotFor(input.routes, input.chosenRoute),
    confidenceBreakdown: input.confidenceBreakdown,
    safeFactsUsed: input.safeFactsUsed,
    warnings: input.warnings,
  };
}
