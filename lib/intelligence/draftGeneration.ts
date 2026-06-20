/**
 * Phase 16 — Draft generation.
 *
 * Generates a short, editable follow-up draft AFTER action selection, using only
 * approved facts (the caller must pass facts already through factsAllowedInDraft).
 * Builds the prompt here (draft-specific prompts live in this workstream file,
 * not in the provider wrapper), calls the configured Gemini JSON provider, and falls
 * back to the saved demo draft when the provider is unavailable or fails.
 *
 * Never auto-sends. Never throws — always returns a Draft with status "drafted".
 */

import "server-only";
import { requestGeminiJson } from "@/lib/providers/gemini";
import { runtimeConfig } from "@/lib/config";
import { part3DemoDraft } from "@/lib/demo/savedExamples";
import { deterministicId } from "@/lib/utils";
import type {
  Contact,
  ContactCandidate,
  Draft,
  EvidenceFact,
  RecommendedActionType,
  UserObjectiveProfile,
} from "@/lib/types";

const SYSTEM_PROMPT =
  "You write concise professional follow-ups based only on approved facts. Do not invent details. Match the requested tone. Avoid pushiness. The user remains in control. Return JSON only.";

interface DraftJson {
  channel?: Draft["channel"];
  tone?: string | null;
  subject?: string | null;
  body?: string;
  facts_used?: string[];
  risk_note?: string | null;
}

function buildUserPrompt(input: {
  objective: UserObjectiveProfile;
  contact: Contact | ContactCandidate;
  action: RecommendedActionType;
  facts: EvidenceFact[];
  whyThis: string[];
  recipientBurden: number;
  tone: string;
}): string {
  const factLines = input.facts.map((f) => `- ${f.fact}`).join("\n") || "- (none)";
  const whyLines = input.whyThis.map((w) => `- ${w}`).join("\n") || "- (none)";
  const contact = input.contact;
  return [
    "User objective:",
    JSON.stringify(
      {
        role: input.objective.role,
        primaryGoal: input.objective.primaryGoal,
        companyName: input.objective.companyName,
        productDescription: input.objective.productDescription,
        eventContext: input.objective.eventContext,
      },
      null,
      2,
    ),
    "",
    "Contact:",
    JSON.stringify(
      { name: contact.name, role: contact.role, company: contact.company },
      null,
      2,
    ),
    "",
    `Chosen action:\n${input.action}`,
    "",
    `Approved facts:\n${factLines}`,
    "",
    `Why this action:\n${whyLines}`,
    "",
    `Recipient burden (0-1, keep it low/non-pushy):\n${input.recipientBurden.toFixed(2)}`,
    "",
    `Tone:\n${input.tone}`,
    "",
    "Generate JSON with: channel, tone, subject (if email), body, facts_used, risk_note.",
    "Return JSON only.",
  ].join("\n");
}

function fixtureDraft(
  recommendationId: string,
  contactId: string,
  tone: string,
  facts: EvidenceFact[],
  nowIso: string,
  extraWarning?: string,
): Draft {
  // Only surface fixture facts that were actually approved (subset safety).
  const approvedTexts = new Set(facts.map((f) => f.fact));
  const factsUsed =
    facts.length > 0
      ? part3DemoDraft.facts_used.filter((f) => approvedTexts.has(f))
      : [];
  const usedFacts = factsUsed.length > 0 ? factsUsed : facts.map((f) => f.fact);
  return {
    id: deterministicId("draft", `${recommendationId}:${tone}`),
    recommendationId,
    contactId,
    channel: part3DemoDraft.channel,
    tone: tone || part3DemoDraft.tone,
    subject: part3DemoDraft.subject,
    body: part3DemoDraft.body,
    factsUsed: usedFacts,
    status: "drafted",
    riskNote: extraWarning ?? part3DemoDraft.risk_note,
    createdAt: nowIso,
    sentAt: null,
  };
}

/**
 * Generate a draft for the chosen action. Returns a fixture draft when the
 * configured LLM provider is unavailable or its output cannot be parsed. Never throws.
 */
export async function generateDraft(input: {
  recommendationId: string;
  contactId: string;
  objective: UserObjectiveProfile;
  contact: Contact | ContactCandidate;
  action: RecommendedActionType;
  factsAllowedInDraft: EvidenceFact[];
  whyThis: string[];
  recipientBurden: number;
  tone: string;
  now?: Date;
}): Promise<Draft> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const tone = input.tone || "warm";

  try {
    const outcome = await requestGeminiJson({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt({
        objective: input.objective,
        contact: input.contact,
        action: input.action,
        facts: input.factsAllowedInDraft,
        whyThis: input.whyThis,
        recipientBurden: input.recipientBurden,
        tone,
      }),
      timeoutMs: runtimeConfig.timeouts.draftMs,
    });

    if (outcome.provider === "fixture" || !outcome.json) {
      return fixtureDraft(
        input.recommendationId,
        input.contactId,
        tone,
        input.factsAllowedInDraft,
        nowIso,
      );
    }

    const parsed = outcome.json as DraftJson;
    if (!parsed || !parsed.body) {
      return fixtureDraft(
        input.recommendationId,
        input.contactId,
        tone,
        input.factsAllowedInDraft,
        nowIso,
      );
    }

    // Restrict facts_used to facts we actually approved.
    const approved = new Set(input.factsAllowedInDraft.map((f) => f.fact));
    const factsUsed = (parsed.facts_used ?? []).filter((f) => approved.has(f));

    return {
      id: deterministicId("draft", `${input.recommendationId}:${tone}`),
      recommendationId: input.recommendationId,
      contactId: input.contactId,
      channel: parsed.channel ?? "email",
      tone: parsed.tone ?? tone,
      subject: parsed.subject ?? null,
      body: parsed.body,
      factsUsed,
      status: "drafted",
      riskNote: parsed.risk_note ?? null,
      createdAt: nowIso,
      sentAt: null,
    };
  } catch {
    return fixtureDraft(
      input.recommendationId,
      input.contactId,
      tone,
      input.factsAllowedInDraft,
      nowIso,
    );
  }
}
