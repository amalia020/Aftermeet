/**
 * Conversation atom extraction (Part 1, Phase 4).
 *
 * Builds the Claude system+user prompts, calls the shared Claude transport,
 * parses and defensively validates the JSON, and falls back to the saved demo
 * extraction fixture when no key is configured or the model misbehaves.
 *
 * Fixture-first: this function NEVER throws. On any failure it returns the demo
 * extraction adapted to the input and labels the provider "fixture".
 *
 * Server-only — it reads secrets transitively via lib/providers/claude.
 */

import "server-only";

import { runtimeConfig } from "@/lib/config";
import { claudeComplete } from "@/lib/providers/claude";
import { safeJsonParse } from "@/lib/providers/runtime";
import { clamp01 } from "@/lib/utils";
import { part1DemoExtraction } from "@/lib/demo/savedExamples";
import type {
  AtomAsk,
  AtomCommitment,
  AtomFact,
  AtomOffer,
  ContactCandidate,
  ConversationAtoms,
  ConversationAtomsExtractionResult,
  ExtractionProviderResult,
  OpportunityHint,
  OpportunityType,
  UserObjectiveProfile,
} from "@/lib/types";

const VALID_OPPORTUNITY_TYPES: ReadonlySet<OpportunityType> = new Set([
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
]);

const VALID_COMMITMENT_OWNERS = new Set([
  "user",
  "contact",
  "shared",
  "unknown",
]);

const SYSTEM_PROMPT = [
  "You extract structured professional conversation information.",
  "Return JSON only. Do not invent facts. If uncertain, put details in uncertainties.",
  "Never output sensitive personal data such as health, religion, sexuality, immigration status, or anything not professional and necessary.",
  "Separate confident facts from uncertain details: anything you are not sure about belongs in uncertainties, never in facts.",
  "Surface opportunity hints (route + score 0..1 + evidence) but do NOT choose an action and do NOT write a follow-up message yet.",
  "Do not write a follow-up message yet.",
].join(" ");

/** Compact JSON schema description used in the user prompt. */
const SCHEMA_HINT = `Return JSON with exactly this shape:
{
  "contactCandidate": { "name": string|null, "role": string|null, "company": string|null, "email": string|null, "phone": string|null, "website": string|null, "linkedinUrl": string|null },
  "atoms": {
    "facts": [ { "text": string, "type": string, "confidence": number, "isProfessional": boolean, "isSensitive": boolean } ],
    "asks": [ { "text": string, "askSize": number, "explicitness": number } ],
    "offers": [ { "text": string, "mutualValue": number } ],
    "commitments": [ { "text": string, "owner": "user"|"contact"|"shared"|"unknown", "dueAt": string|null, "explicitness": number } ],
    "uncertainties": [ string ],
    "sentiment": string|null,
    "extractionConfidence": number
  },
  "opportunityHints": [ { "route": "raise"|"hire"|"user"|"partner"|"mentor"|"candidate"|"customer"|"sponsor"|"job"|"community"|"other", "score": number, "evidence": [ string ] } ]
}`;

function buildUserPrompt(
  rawText: string,
  objective: UserObjectiveProfile,
): string {
  const objectiveSummary = {
    role: objective.role,
    primaryGoal: objective.primaryGoal,
    secondaryGoals: objective.secondaryGoals,
    eventContext: objective.eventContext ?? null,
    companyName: objective.companyName ?? null,
    productDescription: objective.productDescription ?? null,
    targetCustomer: objective.targetCustomer ?? null,
    constraints: objective.constraints,
  };

  return [
    "User objective (for relevance, not to be invented into facts):",
    JSON.stringify(objectiveSummary),
    "",
    "Conversation capture (the user's own summary of a conversation they had):",
    rawText,
    "",
    SCHEMA_HINT,
    "",
    "Rules: only include facts you are confident are professional and present in the text.",
    "Move anything uncertain into uncertainties. Drop anything sensitive and non-professional.",
    "Scores are numbers in [0,1]. Return JSON only, no prose, no markdown fences.",
  ].join("\n");
}

// ---------- defensive coercion ----------

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asScore(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp01(value);
  }
  return clamp01(fallback);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function coerceContactCandidate(value: unknown): ContactCandidate {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    name: asNullableString(obj.name),
    role: asNullableString(obj.role),
    company: asNullableString(obj.company),
    email: asNullableString(obj.email),
    phone: asNullableString(obj.phone),
    website: asNullableString(obj.website),
    linkedinUrl: asNullableString(obj.linkedinUrl),
  };
}

function coerceFacts(value: unknown): AtomFact[] {
  const out: AtomFact[] = [];
  for (const raw of asArray(value)) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const text = asString(obj.text);
    if (!text) continue;
    // Privacy: drop anything explicitly flagged sensitive and non-professional.
    const isSensitive = obj.isSensitive === true;
    const isProfessional = obj.isProfessional !== false;
    if (isSensitive && !isProfessional) continue;
    out.push({
      text,
      type: asString(obj.type),
      confidence:
        typeof obj.confidence === "number" ? asScore(obj.confidence) : undefined,
      isProfessional,
      isSensitive,
    });
  }
  return out;
}

function coerceAsks(value: unknown): AtomAsk[] {
  const out: AtomAsk[] = [];
  for (const raw of asArray(value)) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const text = asString(obj.text);
    if (!text) continue;
    out.push({
      text,
      askSize:
        typeof obj.askSize === "number" ? asScore(obj.askSize) : undefined,
      explicitness:
        typeof obj.explicitness === "number"
          ? asScore(obj.explicitness)
          : undefined,
    });
  }
  return out;
}

function coerceOffers(value: unknown): AtomOffer[] {
  const out: AtomOffer[] = [];
  for (const raw of asArray(value)) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const text = asString(obj.text);
    if (!text) continue;
    out.push({
      text,
      mutualValue:
        typeof obj.mutualValue === "number"
          ? asScore(obj.mutualValue)
          : undefined,
    });
  }
  return out;
}

function coerceCommitments(value: unknown): AtomCommitment[] {
  const out: AtomCommitment[] = [];
  for (const raw of asArray(value)) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const text = asString(obj.text);
    if (!text) continue;
    const ownerRaw = typeof obj.owner === "string" ? obj.owner : "unknown";
    const owner = (
      VALID_COMMITMENT_OWNERS.has(ownerRaw) ? ownerRaw : "unknown"
    ) as AtomCommitment["owner"];
    out.push({
      text,
      owner,
      dueAt: asNullableString(obj.dueAt),
      explicitness:
        typeof obj.explicitness === "number"
          ? asScore(obj.explicitness)
          : undefined,
    });
  }
  return out;
}

function coerceUncertainties(value: unknown): string[] {
  return asArray(value)
    .map((v) => asString(v))
    .filter((v): v is string => Boolean(v));
}

function coerceOpportunityHints(value: unknown): OpportunityHint[] {
  const out: OpportunityHint[] = [];
  for (const raw of asArray(value)) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const routeRaw = typeof obj.route === "string" ? obj.route : "other";
    const route = (
      VALID_OPPORTUNITY_TYPES.has(routeRaw as OpportunityType)
        ? routeRaw
        : "other"
    ) as OpportunityType;
    const evidence = asArray(obj.evidence)
      .map((v) => asString(v))
      .filter((v): v is string => Boolean(v));
    out.push({
      route,
      score: asScore(obj.score),
      evidence,
    });
  }
  return out;
}

function coerceAtoms(value: unknown): ConversationAtoms {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    facts: coerceFacts(obj.facts),
    asks: coerceAsks(obj.asks),
    offers: coerceOffers(obj.offers),
    commitments: coerceCommitments(obj.commitments),
    uncertainties: coerceUncertainties(obj.uncertainties),
    sentiment: asNullableString(obj.sentiment),
    extractionConfidence: asScore(obj.extractionConfidence, 0.5),
  };
}

function coerceResult(value: unknown): ConversationAtomsExtractionResult {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    contactCandidate: coerceContactCandidate(obj.contactCandidate),
    atoms: coerceAtoms(obj.atoms),
    opportunityHints: coerceOpportunityHints(obj.opportunityHints),
  };
}

/**
 * Adapt the saved demo extraction to the current input. We keep the rich demo
 * atoms (so the cascade UI always has something to show) but make the contact
 * candidate honest: if the raw text is empty there is nothing to claim.
 */
function adaptFixture(
  rawText: string,
): ConversationAtomsExtractionResult {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return {
      contactCandidate: {
        name: null,
        role: null,
        company: null,
        email: null,
        phone: null,
        website: null,
        linkedinUrl: null,
      },
      atoms: {
        facts: [],
        asks: [],
        offers: [],
        commitments: [],
        uncertainties: ["No conversation text was provided to extract from."],
        sentiment: null,
        extractionConfidence: 0,
      },
      opportunityHints: [],
    };
  }
  // Deep-copy the fixture so callers cannot mutate the shared constant.
  return coerceResult(
    JSON.parse(JSON.stringify(part1DemoExtraction)),
  );
}

export interface ExtractConversationAtomsInput {
  rawText: string;
  userObjective: UserObjectiveProfile;
  now?: Date;
}

export interface ExtractConversationAtomsOutput {
  result: ConversationAtomsExtractionResult;
  extraction: ExtractionProviderResult;
}

/**
 * Extract conversation atoms from raw text against a user objective.
 *
 * On live success: provider = "claude", model from runtimeConfig.
 * On fallback (no key / timeout / parse failure): provider = "fixture" with a
 * warning. Never throws.
 */
export async function extractConversationAtoms(
  input: ExtractConversationAtomsInput,
): Promise<ExtractConversationAtomsOutput> {
  const { rawText, userObjective } = input;

  const fixtureResult = adaptFixture(rawText);
  const fixtureOutput = (warnings: string[]): ExtractConversationAtomsOutput => ({
    result: fixtureResult,
    extraction: {
      provider: "fixture",
      model: "demo",
      extractionConfidence: fixtureResult.atoms.extractionConfidence,
      warnings,
    },
  });

  // Nothing to send the model; short-circuit to the (empty) fixture.
  if (rawText.trim().length === 0) {
    return fixtureOutput(["extraction: empty input, using fixture"]);
  }

  let outcome;
  try {
    outcome = await claudeComplete({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(rawText, userObjective),
      timeoutMs: runtimeConfig.timeouts.extractionMs,
      maxTokens: 1500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fixtureOutput([`extraction: provider threw (${message}), using fixture`]);
  }

  if (outcome.mode === "fallback") {
    return fixtureOutput([
      "extraction: provider fallback, using fixture",
      ...outcome.warnings,
    ]);
  }

  const parsed = safeJsonParse<unknown>(outcome.data);
  if (parsed === null) {
    return fixtureOutput([
      "extraction: claude returned unparseable JSON, using fixture",
      ...outcome.warnings,
    ]);
  }

  const result = coerceResult(parsed);
  return {
    result,
    extraction: {
      provider: "claude",
      model: runtimeConfig.models.anthropic,
      extractionConfidence: result.atoms.extractionConfidence,
      warnings: outcome.warnings,
    },
  };
}
