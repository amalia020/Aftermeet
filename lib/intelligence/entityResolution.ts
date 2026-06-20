import type {
  ContactCandidate,
  EntityMatchLabel,
  EntityResolutionSummary,
  NumericScore
} from "@/lib/types";
import {
  clamp01,
  domainFromValue,
  freshnessScore,
  normalizeText,
  roundScore,
  tokenSimilarity
} from "@/lib/intelligence/utils";

export function entityMatchConfidence(input: {
  capturedName?: string | null;
  capturedCompany?: string | null;
  capturedRole?: string | null;
  capturedDomain?: string | null;
  candidateName?: string | null;
  candidateCompany?: string | null;
  candidateRole?: string | null;
  candidateDomain?: string | null;
  sourceAgreementScore?: NumericScore;
  lastUpdated?: string | null;
}): NumericScore {
  const capturedDomain = domainFromValue(input.capturedDomain);
  const candidateDomain = domainFromValue(input.candidateDomain);
  const domainMatch =
    capturedDomain && candidateDomain
      ? capturedDomain === candidateDomain
        ? 1
        : tokenSimilarity(capturedDomain, candidateDomain)
      : 0;

  const score =
    0.3 * tokenSimilarity(input.capturedName, input.candidateName) +
    0.25 * tokenSimilarity(input.capturedCompany, input.candidateCompany) +
    0.15 * tokenSimilarity(input.capturedRole, input.candidateRole) +
    0.15 * domainMatch +
    0.1 * clamp01(input.sourceAgreementScore ?? 0.5) +
    0.05 * freshnessScore(input.lastUpdated);

  return roundScore(score);
}

export function entityMatchLabel(score: NumericScore): EntityMatchLabel {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.3) return "low";
  return "no_match";
}

export function summarizeEntityResolution(input: {
  captured: ContactCandidate;
  candidateName?: string | null;
  candidateCompany?: string | null;
  candidateRole?: string | null;
  candidateDomain?: string | null;
  score?: NumericScore;
  lastUpdated?: string | null;
}): EntityResolutionSummary {
  const capturedDomain = domainFromValue(input.captured.website ?? input.captured.email);
  const score =
    input.score ??
    entityMatchConfidence({
      capturedName: input.captured.name,
      capturedCompany: input.captured.company,
      capturedRole: input.captured.role,
      capturedDomain,
      candidateName: input.candidateName,
      candidateCompany: input.candidateCompany,
      candidateRole: input.candidateRole,
      candidateDomain: input.candidateDomain,
      lastUpdated: input.lastUpdated
    });
  const label = entityMatchLabel(score);
  const reasons: string[] = [];

  if (normalizeText(input.captured.company) && normalizeText(input.captured.company) === normalizeText(input.candidateCompany)) {
    reasons.push("Captured company matches retrieved company.");
  }
  if (capturedDomain && input.candidateDomain && domainFromValue(input.candidateDomain) === capturedDomain) {
    reasons.push("Captured domain matches retrieved domain.");
  }
  if (input.captured.name && !input.candidateName) {
    reasons.push("No retrieved person-level match was available.");
  }
  if (label === "low" || label === "no_match") {
    reasons.push("Entity confidence is low enough to require user confirmation.");
  }
  if (!reasons.length) {
    reasons.push("Entity confidence is based on available name, company, role, source, and freshness signals.");
  }

  return {
    capturedName: input.captured.name ?? undefined,
    capturedCompany: input.captured.company ?? undefined,
    capturedRole: input.captured.role ?? undefined,
    capturedDomain,
    candidateName: input.candidateName ?? undefined,
    candidateCompany: input.candidateCompany ?? undefined,
    candidateRole: input.candidateRole ?? undefined,
    candidateDomain: input.candidateDomain ?? undefined,
    score,
    label,
    needsUserConfirmation: label === "low" || label === "no_match",
    reasons
  };
}
