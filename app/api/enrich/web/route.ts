import type { WebFallbackRequest } from "@/lib/types";
import { conversationBelongsToUser } from "@/lib/db/queries";
import { geminiWebContext } from "@/lib/providers/gemini";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import { inferSourceTypeFromUrl } from "@/lib/intelligence/utils";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString
} from "@/lib/server/http";

export const runtime = "nodejs";

function sourceNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "grounded web source";
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<WebFallbackRequest>(request);
    const userId = requiredString(body.userId, "userId");
    const conversationId = requiredString(body.conversationId, "conversationId");
    const query = requiredString(body.query, "query");
    if (body.calaAttempted !== true) {
      throw new HttpError(
        422,
        "FALLBACK_ORDER_VIOLATION",
        "Web fallback cannot run before Cala is attempted."
      );
    }
    if (!(await conversationBelongsToUser(conversationId, userId))) {
      throw new HttpError(422, "ENRICHMENT_NOT_ALLOWED", "Contact was not captured by this user.");
    }

    const web = await geminiWebContext({
      name: body.name,
      company: body.company,
      role: body.role,
      query
    });
    const allowUncitedClaims = body.allowUncitedClaims !== false;
    const citedClaims = web.claims.filter((claim) => claim.sourceUrl);
    const uncitedClaims = web.claims.filter((claim) => !claim.sourceUrl);
    const claims = allowUncitedClaims ? web.claims : citedClaims;
    const warnings: string[] = [...(web.warnings ?? [])];
    if (
      typeof body.calaMatchConfidence === "number" &&
      body.calaMatchConfidence < 0.5
    ) {
      warnings.push(
        "Cala entity confidence is below 50%. Gemini fallback context may be inaccurate and requires confirmation."
      );
    }
    if (!web.available) {
      warnings.push(
        "Gemini web fallback found no grounded professional context for this query."
      );
    }
    if (web.available && web.claims.length > 0 && claims.length === 0) {
      warnings.push("Gemini returned claims, but none included citation URLs.");
    }
    if (!allowUncitedClaims && claims.length !== web.claims.length) {
      warnings.push(
        `${web.claims.length - claims.length} claims discarded because citation URL was missing.`
      );
    }
    if (allowUncitedClaims && uncitedClaims.length > 0) {
      warnings.push(
        `${uncitedClaims.length} uncited claims were accepted temporarily because allowUncitedClaims=true.`
      );
    }
    const sourceRecords = claims.map((claim) =>
      createSourceRecord({
        provider: "web",
        sourceType: claim.sourceType ?? inferSourceTypeFromUrl(claim.sourceUrl),
        contactId: body.contactId ?? null,
        sourceName: claim.sourceUrl ? sourceNameFromUrl(claim.sourceUrl) : "uncited_web_claim",
        sourceUrl: claim.sourceUrl || undefined,
        retrievedAt: web.retrievedAt,
        notes: claim.sourceUrl
          ? "Gemini grounded web fallback route"
          : "Gemini web fallback route (uncited claim temporarily accepted)"
      })
    );

    return jsonResponse({
      available: web.available && claims.length > 0,
      summary: web.summary,
      claims,
      sourceRecords,
      warnings
    });
  } catch (error) {
    return errorResponse(error);
  }
}
