/**
 * POST /api/enrich/cala (Phase 5).
 *
 * Explicit Cala enrichment for debug/admin use. Application code should prefer
 * `enrichEvidence` so provider order is never bypassed. Server-only (nodejs).
 *
 * Returns a CalaEnrichmentResponse. Cala failures never throw — they surface as
 * available:false so the caller can continue with conversation-only evidence.
 */

import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db/queries";
import { calaKnowledgeSearch } from "@/lib/providers/cala";
import { resolveEntity } from "@/lib/intelligence/entityResolution";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import { deterministicId, extractDomain } from "@/lib/utils";
import type {
  CalaEnrichmentRequest,
  CalaEnrichmentResponse,
  ErrorResponse,
  PublicEntityContext,
  SourceRecord,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Partial<CalaEnrichmentRequest>;
  try {
    body = (await request.json()) as Partial<CalaEnrichmentRequest>;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.conversationId) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "conversationId is required." },
      { status: 400 },
    );
  }
  if (!body.name && !body.company && !body.query) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "VALIDATION_ERROR",
        message: "At least one of name, company, or query is required.",
      },
      { status: 400 },
    );
  }

  const userId = body.userId ?? DEMO_USER_ID;
  const now = new Date();
  const nowIso = now.toISOString();

  const searchTerm =
    body.query ?? [body.name, body.company].filter(Boolean).join(" ").trim();

  const search = await calaKnowledgeSearch(searchTerm);
  const top = search.candidates[0];

  const resolution = resolveEntity({
    capturedName: body.name,
    capturedCompany: body.company,
    capturedRole: body.role,
    candidateName: top?.name,
    candidateCompany: top?.company ?? top?.name,
    candidateRole: top?.role,
    candidateDomain: top?.domain,
    sourceAgreementScore: search.available ? 0.6 : 0,
    lastUpdated: nowIso,
    now,
  });

  const sourceRecords: SourceRecord[] = [];
  let selectedContext: PublicEntityContext | undefined;

  if (search.available && top) {
    const src = createSourceRecord({
      id: deterministicId("src", `cala:${top.providerEntityId}`),
      contactId: body.contactId ?? null,
      provider: "cala",
      sourceType: "cala_verified_fact",
      sourceName: "Cala verified company context",
      sourceUrl: null,
      retrievedAt: nowIso,
      now,
      crossAgreement: 0.6,
    });
    sourceRecords.push(src);

    selectedContext = {
      id: deterministicId("ctx", `cala:${top.providerEntityId}`),
      contactId: body.contactId ?? null,
      provider: "cala",
      providerEntityId: top.providerEntityId,
      entityType: top.entityType,
      canonicalName: top.company ?? top.name,
      rawContext: { domain: top.domain ?? null, confidence: top.confidence ?? null },
      retrievedAt: nowIso,
      confidence: top.confidence ?? resolution.score,
    };
  }

  const response: CalaEnrichmentResponse = {
    available: search.available,
    candidates: search.candidates,
    selectedContext,
    entityMatchConfidence: resolution.score,
    sourceRecords,
    warnings: search.warnings,
  };
  return NextResponse.json(response, { status: 200 });
}
