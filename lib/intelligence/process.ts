import type {
  CaptureType,
  EvidenceBundle,
  ExtractionHandoff,
  Id,
  ProcessConversationRequest,
  ProcessStage,
  ProcessStageEvent
} from "@/lib/types";
import {
  createConversation,
  getActiveObjective,
  getConversation,
  saveConversationAtoms,
  saveExtractionHandoff,
  setConversationContact,
  updateConversationStatus,
  upsertContactFromCandidate
} from "@/lib/db/queries";
import { HttpError } from "@/lib/server/http";
import { extractConversationAtomsDetailed } from "@/lib/intelligence/extraction";
import { enrichEvidence } from "@/lib/intelligence/enrichment";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";

export interface ProcessConversationOutput {
  extractionHandoff: ExtractionHandoff;
  evidenceBundle: EvidenceBundle;
  events: ProcessStageEvent[];
}

export type StageEmitter = (event: ProcessStageEvent) => void | Promise<void>;

function captureSource(captureType: CaptureType): {
  provider: ExtractionHandoff["sourceRecord"]["provider"];
  sourceType: ExtractionHandoff["sourceRecord"]["sourceType"];
} {
  if (captureType === "voice") return { provider: "conversation", sourceType: "user_voice_note" };
  if (captureType === "card") return { provider: "business_card", sourceType: "business_card" };
  return { provider: "conversation", sourceType: "manual" };
}

function normalizedText(input: ProcessConversationRequest, existingRawText?: string): string {
  const text = input.transcript ?? input.cardText ?? input.rawText ?? existingRawText ?? "";
  return text.trim();
}

export async function processConversation(
  input: ProcessConversationRequest,
  emit?: StageEmitter
): Promise<ProcessConversationOutput> {
  const events: ProcessStageEvent[] = [];
  const emitEvent = async (
    stage: ProcessStage,
    status: ProcessStageEvent["status"],
    message?: string,
    payload?: ProcessStageEvent["payload"],
    conversationId?: Id
  ) => {
    const event: ProcessStageEvent = {
      requestId: input.requestId,
      conversationId: conversationId ?? input.conversationId,
      stage,
      status,
      message,
      payload,
      timestamp: new Date().toISOString()
    };
    events.push(event);
    await emit?.(event);
  };

  try {
    const objective = await getActiveObjective(input.userId);
    if (!objective) {
      throw new HttpError(422, "OBJECTIVE_REQUIRED", "No active objective is available.");
    }

    let conversation = input.conversationId ? await getConversation(input.conversationId) : null;
    const rawText = normalizedText(input, conversation?.rawText);
    if (!rawText) {
      throw new HttpError(400, "VALIDATION_ERROR", "Conversation text is required.");
    }

    await emitEvent("capturing", "started", "Normalizing captured conversation.", undefined, conversation?.id);
    if (!conversation) {
      conversation = await createConversation({
        userId: input.userId,
        rawText,
        captureType: input.captureType,
        transcript: input.transcript ?? null,
        eventContext: input.eventContext ?? objective.eventContext ?? null
      });
      input.conversationId = conversation.id;
    }

    if (conversation.userId !== input.userId) {
      throw new HttpError(422, "ENRICHMENT_NOT_ALLOWED", "Conversation does not belong to this user.");
    }

    await updateConversationStatus(conversation.id, "processing");
    await emitEvent("capturing", "completed", "Conversation capture persisted.", undefined, conversation.id);

    if (input.captureType === "voice") {
      await emitEvent(
        "transcribing",
        input.transcript ? "completed" : "fallback",
        input.transcript
          ? "Voice transcript supplied by capture route."
          : "No audio stream is available in process route; using normalized text.",
        undefined,
        conversation.id
      );
    }

    await emitEvent("extracting", "started", "Extracting conversation atoms.", undefined, conversation.id);
    const extraction = await extractConversationAtomsDetailed({
      rawText,
      userObjective: objective
    });
    await emitEvent(
      "extracting",
      "completed",
      "Conversation atoms extracted.",
      { extractionConfidence: extraction.atoms.extractionConfidence },
      conversation.id
    );

    const contact = await upsertContactFromCandidate({
      userId: input.userId,
      candidate: extraction.contactCandidate,
      sourceType:
        input.captureType === "card" ? "card" : input.captureType === "voice" ? "voice" : "manual",
      entityMatchConfidence: 0.5
    });
    if (contact) {
      const updatedConversation = await setConversationContact(conversation.id, contact.id);
      if (updatedConversation) conversation = updatedConversation;
    }

    await emitEvent("persisting_atoms", "started", "Persisting extracted atoms.", undefined, conversation.id);
    await saveConversationAtoms({
      conversationId: conversation.id,
      atoms: extraction.atoms
    });
    await updateConversationStatus(conversation.id, "extracted");
    await emitEvent("persisting_atoms", "completed", "Conversation atoms persisted.", undefined, conversation.id);

    const source = captureSource(input.captureType);
    const sourceRecord = createSourceRecord({
      provider: source.provider,
      sourceType: source.sourceType,
      contactId: conversation.contactId ?? null,
      retrievedAt: conversation.capturedAt
    });

    const extractionHandoff: ExtractionHandoff = {
      requestId: input.requestId,
      userId: input.userId,
      objective,
      conversation,
      contactCandidate: extraction.contactCandidate,
      atoms: extraction.atoms,
      opportunityHints: extraction.opportunityHints,
      extraction: extraction.providerResult,
      sourceRecord: {
        provider: source.provider,
        sourceType: source.sourceType,
        retrievedAt: sourceRecord.retrievedAt,
        sourceConfidence: sourceRecord.sourceConfidence
      }
    };
    await saveExtractionHandoff(extractionHandoff);

    await emitEvent("resolving_entity", "started", "Resolving captured entity.", undefined, conversation.id);
    await emitEvent("retrieving_context", "started", "Retrieving public professional context.", undefined, conversation.id);
    const evidenceBundle = await enrichEvidence(extractionHandoff);
    await emitEvent(
      "resolving_entity",
      "completed",
      "Entity resolution completed.",
      evidenceBundle.entityResolution as unknown as ProcessStageEvent["payload"],
      conversation.id
    );
    await emitEvent(
      "retrieving_context",
      evidenceBundle.enrichment.status === "public_context_unavailable" ? "fallback" : "completed",
      evidenceBundle.enrichment.status === "public_context_unavailable"
        ? "Public context unavailable; continuing with conversation evidence."
        : "Evidence bundle assembled.",
      evidenceBundle.enrichment as unknown as ProcessStageEvent["payload"],
      conversation.id
    );

    await emitEvent(
      "handoff_ready",
      "completed",
      "Extraction handoff and evidence bundle are ready.",
      { extractionHandoff, evidenceBundle } as unknown as ProcessStageEvent["payload"],
      conversation.id
    );

    return { extractionHandoff, evidenceBundle, events };
  } catch (error) {
    if (input.conversationId) await updateConversationStatus(input.conversationId, "failed");
    await emitEvent(
      "failed",
      "failed",
      error instanceof Error ? error.message : "Processing failed.",
      undefined,
      input.conversationId
    );
    throw error;
  }
}
