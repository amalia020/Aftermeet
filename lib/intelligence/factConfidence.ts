import type {
  EvidenceFact,
  ExtractionHandoff,
  PublicEntityContext,
  SourceRecord
} from "@/lib/types";
import { clamp01, freshnessScore, roundScore } from "@/lib/intelligence/utils";

export function factConfidence(fact: EvidenceFact): number {
  return roundScore(
    clamp01(
      fact.sourceConfidence *
        fact.entityMatchConfidence *
        fact.extractionConfidence *
        fact.freshness *
        (1 - fact.contradictionPenalty)
    )
  );
}

function isSensitiveFact(text: string): boolean {
  return /\b(health|medical|religion|political|family|address|ssn|passport)\b/i.test(text);
}

interface ContextFactCandidate {
  text: string;
  sourceUrl?: string | null;
}

function contextFacts(context: PublicEntityContext): ContextFactCandidate[] {
  const raw = context.rawContext;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const facts = (raw as { facts?: unknown }).facts;
  if (!Array.isArray(facts)) return [];
  return facts
    .map((fact): ContextFactCandidate | null => {
      if (typeof fact === "string" && fact.trim().length > 0) {
        return { text: fact };
      }
      if (
        typeof fact === "object" &&
        fact !== null &&
        !Array.isArray(fact) &&
        typeof (fact as { text?: unknown }).text === "string"
      ) {
        return {
          text: (fact as { text: string }).text,
          sourceUrl:
            typeof (fact as { sourceUrl?: unknown }).sourceUrl === "string"
              ? (fact as { sourceUrl: string }).sourceUrl
              : null
        };
      }
      return null;
    })
    .filter((fact): fact is ContextFactCandidate => Boolean(fact));
}

export function buildEvidenceFacts(input: {
  handoff: ExtractionHandoff;
  publicContext: PublicEntityContext[];
  sourceRecords: SourceRecord[];
  entityMatchConfidence: number;
}): EvidenceFact[] {
  const now = new Date().toISOString();
  const conversationSource = input.sourceRecords.find(
    (source) => source.provider === input.handoff.sourceRecord.provider
  );
  const facts: EvidenceFact[] = [];

  for (const atom of input.handoff.atoms.facts) {
    const isSensitive = atom.isSensitive ?? isSensitiveFact(atom.text);
    const fact: EvidenceFact = {
      id: `fact_${crypto.randomUUID()}`,
      contactId: input.handoff.conversation.contactId ?? undefined,
      conversationId: input.handoff.conversation.id,
      fact: atom.text,
      factType: atom.type ?? null,
      sourceRecordId: conversationSource?.id ?? null,
      sourceType: conversationSource?.sourceType ?? input.handoff.sourceRecord.sourceType,
      entityMatchConfidence: 1,
      sourceConfidence:
        conversationSource?.sourceConfidence ?? input.handoff.sourceRecord.sourceConfidence,
      extractionConfidence:
        atom.confidence ?? input.handoff.extraction.extractionConfidence ?? input.handoff.atoms.extractionConfidence,
      freshness: freshnessScore(input.handoff.sourceRecord.retrievedAt),
      contradictionPenalty: 0,
      factConfidence: 0,
      safeForDraft: false,
      isProfessional: atom.isProfessional ?? !isSensitive,
      isSensitive,
      createdAt: now
    };
    fact.factConfidence = factConfidence(fact);
    fact.safeForDraft =
      fact.factConfidence >= 0.75 && fact.isProfessional && !fact.isSensitive && Boolean(fact.sourceRecordId);
    facts.push(fact);
  }

  for (const context of input.publicContext) {
    for (const contextFact of contextFacts(context)) {
      const source = input.sourceRecords.find(
        (record) =>
          (contextFact.sourceUrl && record.sourceUrl === contextFact.sourceUrl) ||
          record.provider === (context.provider === "gemini" ? "web" : context.provider) ||
          record.sourceName === context.canonicalName
      );
      const isSensitive = isSensitiveFact(contextFact.text);
      const fact: EvidenceFact = {
        id: `fact_${crypto.randomUUID()}`,
        contactId: context.contactId ?? input.handoff.conversation.contactId ?? undefined,
        conversationId: input.handoff.conversation.id,
        fact: contextFact.text,
        factType: "public_context",
        sourceRecordId: source?.id ?? null,
        sourceType: source?.sourceType ?? "unknown",
        entityMatchConfidence: input.entityMatchConfidence,
        sourceConfidence: source?.sourceConfidence ?? 0.2,
        extractionConfidence: context.provider === "cala" ? 0.9 : 0.72,
        freshness: freshnessScore(context.retrievedAt),
        contradictionPenalty: input.entityMatchConfidence < 0.3 ? 0.35 : 0,
        factConfidence: 0,
        safeForDraft: false,
        isProfessional: !isSensitive,
        isSensitive,
        createdAt: now
      };
      fact.factConfidence = factConfidence(fact);
      fact.safeForDraft =
        fact.factConfidence >= 0.75 &&
        fact.isProfessional &&
        !fact.isSensitive &&
        Boolean(fact.sourceRecordId) &&
        input.entityMatchConfidence >= 0.75;
      facts.push(fact);
    }
  }

  return facts;
}
