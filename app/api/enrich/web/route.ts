/**
 * POST /api/enrich/web (Phase 5b).
 *
 * Explicit web fallback for debug/admin use. FALLBACK-ONLY: the request MUST
 * record that Cala was attempted (`calaAttempted: true`); otherwise we reject
 * with FALLBACK_ORDER_VIOLATION. Application code should prefer `enrichEvidence`.
 *
 * Every returned claim carries a citation URL (uncited claims are discarded by
 * the provider). Web facts are lower confidence and not draft-safe by default.
 * Server-only (nodejs). Never throws.
 */

import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/db/queries";
import { geminiWebContext } from "@/lib/providers/gemini";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import { deterministicId } from "@/lib/utils";
import type {
  ErrorResponse,
  SourceRecord,
  WebFallbackRequest,
  WebFallbackResponse,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Partial<WebFallbackRequest>;
  try {
    body = (await request.json()) as Partial<WebFallbackRequest>;
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
  if (!body.query || body.query.trim().length === 0) {
    return NextResponse.json<ErrorResponse>(
      { error: "VALIDATION_ERROR", message: "query is required." },
      { status: 400 },
    );
  }
  if (!body.name && !body.company) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "VALIDATION_ERROR",
        message: "At least one of name or company is required.",
      },
      { status: 400 },
    );
  }

  // Fallback-only semantics: web search must never run before Cala.
  if (body.calaAttempted !== true) {
    return NextResponse.json<ErrorResponse>(
      {
        error: "FALLBACK_ORDER_VIOLATION",
        message: "Web fallback requires calaAttempted: true. Try Cala first.",
      },
      { status: 422 },
    );
  }

  const userId = body.userId ?? DEMO_USER_ID;
  const now = new Date();

  const web = await geminiWebContext({
    name: body.name,
    company: body.company,
    role: body.role,
    query: body.query,
    now,
  });

  const sourceRecords: SourceRecord[] = [];
  const warnings: string[] = [];

  for (const claim of web.claims) {
    if (!claim.sourceUrl) {
      warnings.push("SOURCE_REQUIRED: discarded uncited web claim");
      continue;
    }
    sourceRecords.push(
      createSourceRecord({
        id: deterministicId("src", `web:${claim.sourceUrl}`),
        contactId: body.contactId ?? null,
        provider: "web",
        sourceType: claim.sourceType,
        sourceName: "Web search citation",
        sourceUrl: claim.sourceUrl,
        retrievedAt: web.retrievedAt,
        now,
      }),
    );
  }

  const response: WebFallbackResponse = {
    available: web.available,
    summary: web.summary,
    claims: web.claims,
    sourceRecords,
    warnings,
  };
  return NextResponse.json(response, { status: 200 });
}
