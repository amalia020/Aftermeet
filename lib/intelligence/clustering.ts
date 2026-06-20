/**
 * Phase 9 — Contact clustering.
 *
 * Classifies a contact into multi-label `ContactClusterScores` from the contact
 * record, conversation atoms, and (optional) public context. A single contact
 * can be e.g. both a potential user and a mentor; we keep several medium scores
 * rather than forcing one false-high label.
 *
 * Pure and deterministic.
 */

import { clamp01 } from "@/lib/utils";
import type {
  Contact,
  ContactClusterScores,
  ConversationAtoms,
  PublicEntityContext,
} from "@/lib/types";

type ClusterKey = keyof ContactClusterScores;

const EMPTY_SCORES: ContactClusterScores = {
  investor: 0,
  potentialUser: 0,
  potentialHire: 0,
  mentor: 0,
  partner: 0,
  recruiter: 0,
  sponsor: 0,
  founderPeer: 0,
  lowPriority: 0,
};

/** Keyword → cluster signals applied against role/company/fact text. */
const KEYWORD_SIGNALS: { match: RegExp; cluster: ClusterKey; weight: number }[] = [
  { match: /\b(invest|investor|vc|venture|fund|partner at|angel|capital)\b/, cluster: "investor", weight: 0.8 },
  { match: /\b(founder|ceo|co-?founder|operator|building|startup)\b/, cluster: "founderPeer", weight: 0.5 },
  { match: /\b(founder|ceo|co-?founder|operator)\b/, cluster: "potentialUser", weight: 0.4 },
  { match: /\b(mentor|advisor|experienced|veteran|coach|years)\b/, cluster: "mentor", weight: 0.6 },
  { match: /\b(recruit|talent|hiring manager|head of people|sourcing)\b/, cluster: "recruiter", weight: 0.8 },
  { match: /\b(engineer|developer|designer|candidate|looking for|job)\b/, cluster: "potentialHire", weight: 0.6 },
  { match: /\b(sponsor|budget|procure|buyer|enterprise|customer|client)\b/, cluster: "sponsor", weight: 0.7 },
  { match: /\b(partner|partnership|integration|collaborat|cross-?promo)\b/, cluster: "partner", weight: 0.7 },
];

function scanText(scores: ContactClusterScores, text: string, factor: number): void {
  if (!text) return;
  const lower = text.toLowerCase();
  for (const signal of KEYWORD_SIGNALS) {
    if (signal.match.test(lower)) scores[signal.cluster] += signal.weight * factor;
  }
}

/**
 * Classify the contact into multi-label cluster scores. Always returns scores
 * (uses conversation atoms even when public context is missing).
 */
export function classifyContactCluster(input: {
  contact: Contact;
  atoms: ConversationAtoms;
  publicContext?: PublicEntityContext[] | PublicEntityContext;
}): ContactClusterScores {
  const scores: ContactClusterScores = { ...EMPTY_SCORES };
  const { contact, atoms } = input;

  // Role / company text from the contact record.
  scanText(scores, contact.role ?? "", 1);
  scanText(scores, contact.company ?? "", 0.6);

  // Conversation atoms: facts, offers, asks all carry signal.
  for (const fact of atoms.facts ?? []) scanText(scores, fact.text, 0.8);
  for (const offer of atoms.offers ?? []) {
    scanText(scores, offer.text, 0.7);
    // A mutually valuable offer to use the product → potential user signal.
    if ((offer.mutualValue ?? 0) >= 0.5) scores.potentialUser += 0.5 * (offer.mutualValue ?? 0);
  }
  for (const ask of atoms.asks ?? []) scanText(scores, ask.text, 0.5);
  for (const commitment of atoms.commitments ?? []) scanText(scores, commitment.text, 0.5);

  // Public context refines company/fund/person interpretation.
  const contexts = Array.isArray(input.publicContext)
    ? input.publicContext
    : input.publicContext
      ? [input.publicContext]
      : [];
  for (const ctx of contexts) {
    if (ctx.entityType === "fund") scores.investor += 0.6 * clamp01(ctx.confidence);
    if (ctx.entityType === "company") scores.founderPeer += 0.3 * clamp01(ctx.confidence);
    scanText(scores, ctx.canonicalName ?? "", 0.4);
  }

  // Normalize the positive signals so the dominant cluster is 1.0.
  const max = Math.max(...Object.values(scores));
  if (max > 0) {
    for (const key of Object.keys(scores) as ClusterKey[]) {
      scores[key] = clamp01(scores[key] / max);
    }
  } else {
    // No signal at all → this is a low-priority contact.
    scores.lowPriority = 1;
  }

  // lowPriority is the inverse of the strongest positive cluster.
  const strongestPositive = Math.max(
    scores.investor,
    scores.potentialUser,
    scores.potentialHire,
    scores.mentor,
    scores.partner,
    scores.recruiter,
    scores.sponsor,
    scores.founderPeer,
  );
  scores.lowPriority = Math.max(scores.lowPriority, clamp01(1 - strongestPositive));

  return scores;
}
