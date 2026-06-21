/**
 * Process orchestrator (Part 1, ADR-001 / section 7.5). The heart of Part 1.
 *
 * Streams ProcessStageEvent objects as Server-Sent Events (one JSON per
 * `data:` line) while it:
 *   capturing -> extracting -> persisting_atoms -> resolving_entity ->
 *   retrieving_context -> scoring_routes -> choosing_action ->
 *   generating_draft -> handoff_ready (or failed)
 *
 * Pipeline:
 *   load conversation + active objective
 *   -> extractConversationAtoms (Part 1)
 *   -> saveAtoms + upsert Contact from contactCandidate
 *   -> build ExtractionHandoff
 *   -> enrichEvidence(handoff)                 (Part 2, dynamically imported)
 *   -> recommendNextAction({ evidenceBundle, objective })  (Part 3, dynamic)
 *   -> emit handoff_ready with the RecommendationPackage as payload
 *
 * Every external hop is isolated: a failure emits a fallback/failed stage event
 * and the stream substitutes fixtures, but the stream never crashes. The whole
 * pipeline runs from fixtures when no keys are present.
 */

import { resolveRequestUserId } from "@/lib/auth/request";
import {
  getActiveObjectiveForUser,
  getConversationForUser,
  saveAtomsForUser,
  upsertContactForUser,
  upsertConversationForUser,
} from "@/lib/db/store";
import { extractConversationAtoms } from "@/lib/intelligence/extraction";
import { enrichEvidence } from "@/lib/intelligence/enrichment";
import { recommendNextAction } from "@/lib/intelligence/recommend";
import { deterministicId } from "@/lib/utils";
import { part1DemoRawText } from "@/lib/demo/savedExamples";
import {
  part2DemoEvidenceBundle,
  part3DemoRecommendationPackage,
} from "@/lib/demo/fixtures";
import type {
  Contact,
  Conversation,
  ContactCandidate,
  EvidenceBundle,
  ExtractionHandoff,
  JsonValue,
  ProcessConversationRequest,
  ProcessStage,
  ProcessStageEvent,
  RecommendationPackage,
  UserObjectiveProfile,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

function sseLine(event: ProcessStageEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

interface Emitter {
  emit(
    stage: ProcessStage,
    status: ProcessStageEvent["status"],
    extra?: { message?: string; payload?: JsonValue },
  ): void;
}

function makeContactFromCandidate(
  userId: string,
  conversationId: string,
  candidate: ContactCandidate,
  entityMatchConfidence: number,
  now: string,
  sourceType: Contact["sourceType"],
): Contact {
  const seed = `${userId}:${candidate.name ?? ""}:${candidate.company ?? ""}:${conversationId}`;
  return {
    id: deterministicId("contact", seed),
    userId,
    name: candidate.name ?? null,
    role: candidate.role ?? null,
    company: candidate.company ?? null,
    email: candidate.email ?? null,
    phone: candidate.phone ?? null,
    website: candidate.website ?? null,
    linkedinUrl: candidate.linkedinUrl ?? null,
    sourceType,
    entityMatchConfidence,
    createdAt: now,
    updatedAt: now,
  };
}

function contactSourceTypeFor(
  captureType: Conversation["captureType"],
): Contact["sourceType"] {
  if (captureType === "voice") return "voice";
  if (captureType === "card") return "card";
  return "manual";
}

function sourceTypeFor(
  captureType: Conversation["captureType"],
): ExtractionHandoff["sourceRecord"]["sourceType"] {
  if (captureType === "voice") return "user_voice_note";
  if (captureType === "card") return "business_card";
  return "manual";
}

// Part 2 / Part 3 service modules. Both functions are internally fail-safe
// (they catch their own errors and return typed fixture fallbacks), but we keep
// a defensive try/catch here so an unexpected throw can never crash the stream.

/** Run Part 2 enrichment. Failure -> fixture bundle adapted to the handoff. */
async function runEnrichment(
  handoff: ExtractionHandoff,
): Promise<{ bundle: EvidenceBundle; mode: "live" | "fallback"; warning?: string }> {
  try {
    const bundle = await enrichEvidence(handoff);
    return { bundle, mode: "live" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      bundle: adaptEvidenceFixture(handoff),
      mode: "fallback",
      warning: `enrichment failed (${message}); using fixture evidence bundle`,
    };
  }
}

/** Run Part 3 recommendation. Failure -> fixture recommendation package. */
async function runRecommendation(input: {
  evidenceBundle: EvidenceBundle;
  objective: UserObjectiveProfile;
  now: Date;
}): Promise<{
  pkg: RecommendationPackage;
  mode: "live" | "fallback";
  warning?: string;
}> {
  try {
    const pkg = await recommendNextAction({
      evidenceBundle: input.evidenceBundle,
      objective: input.objective,
      now: input.now,
    });
    return { pkg, mode: "live" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      pkg: part3DemoRecommendationPackage,
      mode: "fallback",
      warning: `recommendation failed (${message}); using fixture recommendation`,
    };
  }
}

/** Build a minimal evidence bundle from the handoff when Part 2 is unavailable. */
function adaptEvidenceFixture(handoff: ExtractionHandoff): EvidenceBundle {
  return {
    ...part2DemoEvidenceBundle,
    requestId: handoff.requestId,
    userId: handoff.userId,
    conversationId: handoff.conversation.id,
    contactId: handoff.conversation.contactId ?? part2DemoEvidenceBundle.contactId,
    contactCandidate: handoff.contactCandidate,
    enrichment: {
      ...part2DemoEvidenceBundle.enrichment,
      status: "skipped",
      warnings: [
        ...part2DemoEvidenceBundle.enrichment.warnings,
        "Part 2 enrichment unavailable; demo evidence substituted.",
      ],
    },
  };
}

async function runPipeline(
  emitter: Emitter,
  req: ProcessConversationRequest,
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  // --- capturing: load or synthesize the conversation ---
  emitter.emit("capturing", "started", { message: "Loading conversation" });

  let conversation =
    (req.conversationId ? await getConversationForUser(req.conversationId) : undefined) ??
    undefined;

  if (!conversation) {
    // Allow direct calls that pass raw text without a pre-persisted record.
    const rawText =
      req.rawText ?? req.transcript ?? req.cardText ?? part1DemoRawText;
    const id =
      req.conversationId ??
      deterministicId("conv", `${req.userId}:${nowIso}:${req.captureType}`);
    conversation = {
      id,
      userId: req.userId,
      contactId: null,
      rawText,
      captureType: req.captureType,
      transcript: req.transcript ?? null,
      eventContext: req.eventContext ?? null,
      capturedAt: nowIso,
      processingStatus: "pending",
    };
    await upsertConversationForUser(conversation);
  }

  conversation = await upsertConversationForUser({
    ...conversation,
    processingStatus: "processing",
  });
  emitter.emit("capturing", "completed", {
    payload: { conversationId: conversation.id },
  });

  // --- objective (required; fall back to demo objective) ---
  const objective = await getActiveObjectiveForUser(conversation.userId);
  if (!objective) throw new Error("OBJECTIVE_REQUIRED");

  // --- extracting ---
  emitter.emit("extracting", "started", {
    message: "Extracting conversation atoms",
  });
  const { result, extraction } = await extractConversationAtoms({
    rawText: conversation.rawText,
    userObjective: objective,
    now,
  });
  emitter.emit(
    "extracting",
    extraction.provider === "fixture" ? "fallback" : "completed",
    {
      message:
        extraction.provider === "fixture"
          ? "Used demo extraction"
          : "Extraction complete",
      payload: {
        provider: extraction.provider,
        extractionConfidence: extraction.extractionConfidence,
      },
    },
  );

  // --- persisting_atoms + contact upsert ---
  emitter.emit("persisting_atoms", "started");
  const atomsId = deterministicId("atoms", conversation.id);
  await saveAtomsForUser({
    userId: conversation.userId,
    conversationId: conversation.id,
    atoms: result.atoms,
    id: atomsId,
    createdAt: nowIso,
  });

  const contact = makeContactFromCandidate(
    conversation.userId,
    conversation.id,
    result.contactCandidate,
    extraction.extractionConfidence,
    nowIso,
    contactSourceTypeFor(conversation.captureType),
  );
  await upsertContactForUser(contact);
  conversation = await upsertConversationForUser({
    ...conversation,
    contactId: contact.id,
    processingStatus: "extracted",
  });
  emitter.emit("persisting_atoms", "completed", {
    payload: { contactId: contact.id, atomsId },
  });

  // --- build the handoff (Part 1 -> Part 2 contract) ---
  const handoff: ExtractionHandoff = {
    requestId: req.requestId,
    userId: conversation.userId,
    objective,
    conversation,
    contactCandidate: result.contactCandidate,
    atoms: result.atoms,
    opportunityHints: result.opportunityHints,
    extraction,
    sourceRecord: {
      provider: "conversation",
      sourceType: sourceTypeFor(conversation.captureType),
      retrievedAt: nowIso,
      sourceConfidence: 0.72,
    },
  };

  // --- resolving_entity + retrieving_context (Part 2) ---
  emitter.emit("resolving_entity", "started");
  const enrichment = await runEnrichment(handoff);
  emitter.emit(
    "resolving_entity",
    enrichment.mode === "fallback" ? "fallback" : "completed",
    enrichment.warning ? { message: enrichment.warning } : undefined,
  );
  emitter.emit(
    "retrieving_context",
    enrichment.mode === "fallback" ? "fallback" : "completed",
    {
      payload: { status: enrichment.bundle.enrichment.status },
    },
  );

  // --- scoring_routes -> choosing_action -> generating_draft (Part 3) ---
  emitter.emit("scoring_routes", "started");
  const recommendation = await runRecommendation({
    evidenceBundle: enrichment.bundle,
    objective,
    now,
  });
  emitter.emit(
    "scoring_routes",
    recommendation.mode === "fallback" ? "fallback" : "completed",
  );
  emitter.emit(
    "choosing_action",
    recommendation.mode === "fallback" ? "fallback" : "completed",
    {
      payload: {
        action: recommendation.pkg.recommendation.recommendedAction,
      },
    },
  );
  emitter.emit(
    "generating_draft",
    recommendation.pkg.draft ? "completed" : "fallback",
    recommendation.warning ? { message: recommendation.warning } : undefined,
  );

  // --- handoff_ready: final payload carries the RecommendationPackage ---
  emitter.emit("handoff_ready", "completed", {
    message: "Pipeline complete",
    payload: {
      ...recommendation.pkg,
      extractionHandoff: handoff,
      evidenceBundle: enrichment.bundle,
    } as unknown as JsonValue,
  });
}

function buildStream(req: ProcessConversationRequest): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emitter: Emitter = {
        emit(stage, status, extra) {
          if (closed) return;
          const event: ProcessStageEvent = {
            requestId: req.requestId,
            conversationId: req.conversationId,
            stage,
            status,
            message: extra?.message,
            payload: extra?.payload,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(sseLine(event));
        },
      };

      try {
        await runPipeline(emitter, req);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Mark the conversation failed if we can, then emit a failed event.
        if (req.conversationId) {
          const conv = await getConversationForUser(req.conversationId);
          if (conv) {
            await upsertConversationForUser({ ...conv, processingStatus: "failed" });
          }
        }
        emitter.emit("failed", "failed", { message });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });
}

function streamResponse(req: ProcessConversationRequest): Response {
  return new Response(buildStream(req), {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

async function requestFromSearchParams(url: URL): Promise<ProcessConversationRequest | null> {
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  if (!conversationId) return null;
  const userId = await resolveRequestUserId(url.searchParams.get("userId"));
  const conv = await getConversationForUser(conversationId);
  if (!conv || conv.userId !== userId) return null;
  const requestId =
    url.searchParams.get("requestId") ??
    deterministicId("req", conversationId);
  return {
    requestId,
    userId: conv.userId,
    conversationId,
    captureType: conv.captureType,
    rawText: conv.rawText,
    transcript: conv.transcript ?? undefined,
    eventContext: conv.eventContext ?? undefined,
  };
}

/** GET form: stream for an already-captured conversation (used by streamUrl). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const req = await requestFromSearchParams(url);
  if (!req) {
    return new Response(
      JSON.stringify({
        error: "VALIDATION_ERROR",
        message: "conversationId is required.",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  return streamResponse(req);
}

/** POST form: accepts a ProcessConversationRequest (or just { conversationId }). */
export async function POST(request: Request) {
  let body: Partial<ProcessConversationRequest> = {};
  try {
    body = (await request.json()) as Partial<ProcessConversationRequest>;
  } catch {
    body = {};
  }

  const conversationId = body.conversationId;
  const userId = await resolveRequestUserId(body.userId);
  const conv = conversationId ? await getConversationForUser(conversationId) : undefined;

  if (!conversationId && !body.rawText && !body.transcript && !body.cardText) {
    return new Response(
      JSON.stringify({
        error: "VALIDATION_ERROR",
        message: "Provide conversationId or capture text.",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const req: ProcessConversationRequest = {
    requestId:
      body.requestId ??
      deterministicId("req", conversationId ?? `${Date.now()}`),
    userId: conv?.userId ?? userId,
    conversationId,
    captureType: body.captureType ?? conv?.captureType ?? "text",
    rawText: body.rawText ?? conv?.rawText,
    transcript: body.transcript ?? conv?.transcript ?? undefined,
    cardText: body.cardText,
    eventContext: body.eventContext ?? conv?.eventContext ?? undefined,
  };

  return streamResponse(req);
}
