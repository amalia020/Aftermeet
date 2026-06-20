/**
 * Phase 7 — Entity resolution.
 *
 * Decide whether retrieved public context (Cala candidate / web result) actually
 * matches the contact the user captured, and label how confident we are. Low
 * confidence blocks draft use of enriched facts and asks the user to confirm.
 *
 * Pure and deterministic. No I/O.
 */

import type { EntityMatchLabel, EntityResolutionSummary } from "@/lib/types";
import type { ContactCandidate, NumericScore } from "@/lib/types";
import { clamp01, extractDomain, freshnessScore, nameSimilarity } from "@/lib/utils";

export interface EntityMatchInput {
  capturedName?: string;
  capturedCompany?: string;
  capturedRole?: string;
  capturedDomain?: string;
  candidateName?: string;
  candidateCompany?: string;
  candidateRole?: string;
  candidateDomain?: string;
  /** 0..1 corroboration across independent sources, if known. */
  sourceAgreementScore?: number;
  /** ISO timestamp of when the candidate context was last updated. */
  lastUpdated?: string;
  now?: Date;
}

/**
 * Deterministic entity match confidence (spec Phase 7):
 *
 *   0.30*name + 0.25*company + 0.15*role + 0.15*domain
 *   + 0.10*sourceAgreement + 0.05*freshness
 *
 * Missing captured company does not fail the match outright but the company term
 * contributes 0, lowering the ceiling. Common single-token names with no company
 * therefore land low — which is the desired behaviour (ask for confirmation).
 */
export function entityMatchConfidence(input: EntityMatchInput): number {
  const now = input.now ?? new Date();

  const name = nameSimilarity(input.capturedName, input.candidateName);
  const company = nameSimilarity(input.capturedCompany, input.candidateCompany);
  const role = nameSimilarity(input.capturedRole, input.candidateRole);

  const capturedDomain =
    input.capturedDomain ?? extractDomain(input.capturedDomain) ?? null;
  const candidateDomain =
    input.candidateDomain ?? extractDomain(input.candidateDomain) ?? null;
  const domainMatch =
    capturedDomain && candidateDomain
      ? capturedDomain.toLowerCase() === candidateDomain.toLowerCase()
        ? 1
        : nameSimilarity(capturedDomain, candidateDomain)
      : 0;

  const sourceAgreement = clamp01(input.sourceAgreementScore ?? 0);
  const freshness = input.lastUpdated
    ? freshnessScore(input.lastUpdated, now)
    : 0;

  return clamp01(
    0.3 * name +
      0.25 * company +
      0.15 * role +
      0.15 * domainMatch +
      0.1 * sourceAgreement +
      0.05 * freshness,
  );
}

/** Map a score to a label (spec Phase 7 thresholds). */
export function matchLabel(score: number): EntityMatchLabel {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.3) return "low";
  return "no_match";
}

export const entityMatchLabel = matchLabel;

/**
 * Build the full resolution summary, including the human-readable reasons that
 * Part 4 renders and the `needsUserConfirmation` flag (true below 0.45).
 */
export function resolveEntity(input: EntityMatchInput): EntityResolutionSummary {
  const score = entityMatchConfidence(input);
  const label = matchLabel(score);
  const reasons = buildReasons(input, score, label);

  return {
    capturedName: input.capturedName,
    capturedCompany: input.capturedCompany,
    capturedRole: input.capturedRole,
    capturedDomain: input.capturedDomain,
    candidateName: input.candidateName,
    candidateCompany: input.candidateCompany,
    candidateRole: input.candidateRole,
    candidateDomain: input.candidateDomain,
    score,
    label,
    // Low/medium-low matches must be confirmed before enriched facts are trusted.
    needsUserConfirmation: score < 0.45,
    reasons,
  };
}

export function summarizeEntityResolution(input: {
  captured: ContactCandidate;
  candidateName?: string | null;
  candidateCompany?: string | null;
  candidateRole?: string | null;
  candidateDomain?: string | null;
  score?: NumericScore;
  lastUpdated?: string | null;
  now?: Date;
}): EntityResolutionSummary {
  if (typeof input.score === "number") {
    const score = clamp01(input.score);
    const label = matchLabel(score);
    return {
      capturedName: input.captured.name ?? undefined,
      capturedCompany: input.captured.company ?? undefined,
      capturedRole: input.captured.role ?? undefined,
      capturedDomain:
        extractDomain(input.captured.website) ?? extractDomain(input.captured.email) ?? undefined,
      candidateName: input.candidateName ?? undefined,
      candidateCompany: input.candidateCompany ?? undefined,
      candidateRole: input.candidateRole ?? undefined,
      candidateDomain: input.candidateDomain ?? undefined,
      score,
      label,
      needsUserConfirmation: score < 0.45,
      reasons:
        score < 0.45
          ? ["Entity confidence is low enough to require user confirmation."]
          : ["Entity confidence is based on available captured and retrieved signals."],
    };
  }

  return resolveEntity({
    capturedName: input.captured.name ?? undefined,
    capturedCompany: input.captured.company ?? undefined,
    capturedRole: input.captured.role ?? undefined,
    capturedDomain:
      extractDomain(input.captured.website) ?? extractDomain(input.captured.email) ?? undefined,
    candidateName: input.candidateName ?? undefined,
    candidateCompany: input.candidateCompany ?? undefined,
    candidateRole: input.candidateRole ?? undefined,
    candidateDomain: input.candidateDomain ?? undefined,
    lastUpdated: input.lastUpdated ?? undefined,
    now: input.now,
  });
}

function buildReasons(
  input: EntityMatchInput,
  score: number,
  label: EntityMatchLabel,
): string[] {
  const reasons: string[] = [];

  if (!input.candidateName && !input.candidateCompany) {
    reasons.push("No public candidate was retrieved to compare against.");
    return reasons;
  }

  const nameSim = nameSimilarity(input.capturedName, input.candidateName);
  if (nameSim >= 0.8) {
    reasons.push("Captured name closely matches the retrieved candidate.");
  } else if (nameSim > 0) {
    reasons.push("Captured name partially matches the retrieved candidate.");
  } else if (input.capturedName && input.candidateName) {
    reasons.push("Captured name does not match the retrieved candidate.");
  }

  const companySim = nameSimilarity(input.capturedCompany, input.candidateCompany);
  if (companySim >= 0.8) {
    reasons.push("Company name matches a retrieved entity.");
  } else if (!input.capturedCompany) {
    reasons.push("No company was captured; relying on name-level signals only.");
  } else if (companySim === 0 && input.candidateCompany) {
    reasons.push("Captured company differs from the retrieved entity.");
  }

  if (
    input.capturedDomain &&
    input.candidateDomain &&
    input.capturedDomain.toLowerCase() === input.candidateDomain.toLowerCase()
  ) {
    reasons.push("Email/website domain matches the candidate domain.");
  }

  if (label === "no_match") {
    reasons.push("Overall signal is too weak to claim a match.");
  } else if (score < 0.45) {
    reasons.push("Match confidence is low; user confirmation is required.");
  }

  return reasons;
}
