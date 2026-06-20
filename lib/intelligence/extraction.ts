import type {
  AtomFact,
  ContactCandidate,
  ConversationAtoms,
  ConversationAtomsExtractionResult,
  ExtractionProviderResult,
  JsonValue,
  OpportunityHint,
  OpportunityType,
  UserGoal,
  UserObjectiveProfile
} from "@/lib/types";
import {
  demoExtractionProviderResult,
  demoExtractionResult,
  isDemoMayaConversation
} from "@/lib/demo/fixtures";
import { requestGeminiJson } from "@/lib/providers/gemini";
import { clamp01 } from "@/lib/intelligence/utils";

export interface DetailedExtractionResult extends ConversationAtomsExtractionResult {
  providerResult: ExtractionProviderResult;
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

const SYSTEM_PROMPT =
  "You extract structured professional conversation information. Return JSON only. Do not invent facts. If uncertain, put details in uncertainties. Never output sensitive personal data unless explicitly present and professionally relevant. Do not write a follow-up message yet.";

function goalToOpportunity(goal: UserGoal): OpportunityType {
  const map: Partial<Record<UserGoal, OpportunityType>> = {
    raise: "raise",
    hire: "hire",
    find_users: "user",
    find_design_partners: "partner",
    find_mentors: "mentor",
    find_investments: "raise",
    source_candidates: "candidate",
    find_customers: "customer",
    find_partners: "partner",
    find_job_opportunities: "job",
    build_community: "community",
    collect_wtp: "customer"
  };
  return map[goal] ?? "other";
}

function isRecord(value: JsonValue | unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function coerceContactCandidate(value: unknown): ContactCandidate {
  if (!isRecord(value)) return {};
  return {
    name: typeof value.name === "string" ? value.name : null,
    role: typeof value.role === "string" ? value.role : null,
    company: typeof value.company === "string" ? value.company : null,
    email: typeof value.email === "string" ? value.email : null,
    phone: typeof value.phone === "string" ? value.phone : null,
    website: typeof value.website === "string" ? value.website : null,
    linkedinUrl: typeof value.linkedinUrl === "string" ? value.linkedinUrl : null
  };
}

function coerceFacts(value: unknown): AtomFact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map<AtomFact | null>((item) => {
      if (typeof item === "string") {
        return {
          text: item,
          confidence: 0.55,
          isProfessional: true,
          isSensitive: false
        };
      }
      if (!isRecord(item) || typeof item.text !== "string") return null;
      const sensitive =
        typeof item.isSensitive === "boolean"
          ? item.isSensitive
          : /\b(health|medical|religion|political|family|address)\b/i.test(item.text);
      return {
        text: item.text,
        type: typeof item.type === "string" ? item.type : undefined,
        confidence:
          typeof item.confidence === "number" ? clamp01(item.confidence) : undefined,
        isProfessional:
          typeof item.isProfessional === "boolean" ? item.isProfessional : !sensitive,
        isSensitive: sensitive
      };
    })
    .filter((fact): fact is AtomFact => fact !== null)
    .filter((fact) => fact.isProfessional && !fact.isSensitive);
}

function coerceExtraction(json: JsonValue | undefined): ConversationAtomsExtractionResult | null {
  if (!isRecord(json)) return null;
  const atomsValue = isRecord(json.atoms) ? json.atoms : json;
  const contactCandidate = coerceContactCandidate(json.contactCandidate);
  const facts = coerceFacts(atomsValue.facts);
  const extractionConfidence =
    typeof atomsValue.extractionConfidence === "number"
      ? clamp01(atomsValue.extractionConfidence)
      : facts.length
        ? 0.6
        : 0.25;

  const atoms: ConversationAtoms = {
    facts,
    asks: recordArray(atomsValue.asks)
      .filter((ask) => typeof ask.text === "string")
      .map((ask) => ({
        text: String(ask.text),
        askSize: typeof ask.askSize === "number" ? clamp01(ask.askSize) : undefined,
        explicitness:
          typeof ask.explicitness === "number" ? clamp01(ask.explicitness) : undefined
      })),
    offers: recordArray(atomsValue.offers)
      .filter((offer) => typeof offer.text === "string")
      .map((offer) => ({
        text: String(offer.text),
        mutualValue:
          typeof offer.mutualValue === "number" ? clamp01(offer.mutualValue) : undefined
      })),
    commitments: recordArray(atomsValue.commitments)
      .filter((commitment) => typeof commitment.text === "string")
      .map((commitment) => ({
        text: String(commitment.text),
        owner:
          commitment.owner === "user" ||
          commitment.owner === "contact" ||
          commitment.owner === "shared" ||
          commitment.owner === "unknown"
            ? commitment.owner
            : "unknown",
        dueAt: typeof commitment.dueAt === "string" ? commitment.dueAt : null,
        explicitness:
          typeof commitment.explicitness === "number"
            ? clamp01(commitment.explicitness)
            : undefined
      })),
    uncertainties: stringArray(atomsValue.uncertainties),
    sentiment: typeof atomsValue.sentiment === "string" ? atomsValue.sentiment : null,
    extractionConfidence
  };

  const opportunityHints: OpportunityHint[] = recordArray(json.opportunityHints)
    .filter((hint) => typeof hint.route === "string")
    .map((hint) => ({
      route: hint.route as OpportunityType,
      score: typeof hint.score === "number" ? clamp01(hint.score) : 0.3,
      evidence: stringArray(hint.evidence)
    }));

  return { contactCandidate, atoms, opportunityHints };
}

function heuristicExtraction(rawText: string, userObjective: UserObjectiveProfile): ConversationAtomsExtractionResult {
  const match = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:from|at)\s+([A-Z][A-Za-z0-9-]+)/);
  const name = match?.[1] ?? null;
  const company = match?.[2] ?? null;
  const facts: AtomFact[] = [
    {
      text: rawText.slice(0, 220),
      type: "conversation_summary",
      confidence: 0.45,
      isProfessional: true,
      isSensitive: false
    }
  ];
  if (company) {
    facts.push({
      text: `${name ?? "The contact"} is associated with ${company}.`,
      type: "contact_company",
      confidence: 0.55,
      isProfessional: true,
      isSensitive: false
    });
  }

  return {
    contactCandidate: { name, company, role: null, email: null, phone: null, website: null, linkedinUrl: null },
    atoms: {
      facts,
      asks: [],
      offers: [],
      commitments: [],
      uncertainties: ["Heuristic extraction used; review contact details before outreach."],
      sentiment: null,
      extractionConfidence: 0.46
    },
    opportunityHints: [
      {
        route: goalToOpportunity(userObjective.primaryGoal),
        score: 0.4,
        evidence: ["Route hint inferred from the user's active objective."]
      }
    ]
  };
}

function buildUserPrompt(rawText: string, userObjective: UserObjectiveProfile): string {
  return [
    "User objective:",
    JSON.stringify(userObjective),
    "",
    "Conversation:",
    rawText,
    "",
    "Extract contactCandidate, atoms, opportunityHints, and extractionConfidence. Return JSON only."
  ].join("\n");
}

export async function extractConversationAtomsDetailed(input: {
  rawText: string;
  userObjective: UserObjectiveProfile;
}): Promise<DetailedExtractionResult> {
  if (input.rawText.trim().length === 0) {
    return {
      contactCandidate: {
        name: null,
        role: null,
        company: null,
        email: null,
        phone: null,
        website: null,
        linkedinUrl: null
      },
      atoms: {
        facts: [],
        asks: [],
        offers: [],
        commitments: [],
        uncertainties: ["No conversation text was provided to extract from."],
        sentiment: null,
        extractionConfidence: 0
      },
      opportunityHints: [],
      providerResult: {
        provider: "fixture",
        model: "demo",
        extractionConfidence: 0,
        warnings: ["extraction: empty input, using fixture"]
      }
    };
  }

  if (isDemoMayaConversation(input.rawText)) {
    return {
      ...demoExtractionResult,
      providerResult: demoExtractionProviderResult
    };
  }

  const warnings: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const gemini = await requestGeminiJson({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input.rawText, input.userObjective)
    });
    warnings.push(...gemini.warnings);
    if (gemini.provider === "fixture") break;

    const parsed = coerceExtraction(gemini.json);
    if (parsed) {
      return {
        ...parsed,
        providerResult: {
          provider: "gemini",
          model: gemini.model,
          extractionConfidence: parsed.atoms.extractionConfidence,
          warnings
        }
      };
    }
    warnings.push(`Gemini extraction parse failed on attempt ${attempt + 1}.`);
  }

  const fallback = heuristicExtraction(input.rawText, input.userObjective);
  return {
    ...fallback,
    providerResult: {
      provider: "fixture",
      model: "demo",
      extractionConfidence: fallback.atoms.extractionConfidence,
      warnings: warnings.length ? warnings : ["Using heuristic extraction fixture."]
    }
  };
}

export async function extractConversationAtoms(
  input: ExtractConversationAtomsInput
): Promise<ExtractConversationAtomsOutput> {
  const detailed = await extractConversationAtomsDetailed(input);
  return {
    result: {
      contactCandidate: detailed.contactCandidate,
      atoms: detailed.atoms,
      opportunityHints: detailed.opportunityHints
    },
    extraction: detailed.providerResult
  };
}
