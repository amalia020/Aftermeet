import type { CalaEnrichmentRequest, PublicEntityContext } from "@/lib/types";
import { conversationBelongsToUser } from "@/lib/db/queries";
import { calaEntitySearch, calaRetrieveEntity } from "@/lib/providers/cala";
import { summarizeEntityResolution } from "@/lib/intelligence/entityResolution";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<CalaEnrichmentRequest>(request);
    const userId = requiredString(body.userId, "userId");
    const conversationId = requiredString(body.conversationId, "conversationId");
    const query = [body.query, body.name, body.role, body.company].filter(Boolean).join(" ").trim();
    if (!query) {
      throw new HttpError(400, "VALIDATION_ERROR", "Candidate or query input is required.");
    }
    if (!(await conversationBelongsToUser(conversationId, userId))) {
      throw new HttpError(422, "ENRICHMENT_NOT_ALLOWED", "Contact was not captured by this user.");
    }

    const candidates = await calaEntitySearch(query);
    const selected = candidates[0];
    const detail = selected ? await calaRetrieveEntity(selected.providerEntityId) : null;
    const entityResolution = summarizeEntityResolution({
      captured: {
        name: body.name ?? null,
        company: body.company ?? null,
        role: body.role ?? null
      },
      candidateName: selected?.entityType === "person" ? selected.name : body.name,
      candidateCompany: selected?.company ?? detail?.canonicalName,
      candidateRole: selected?.role,
      candidateDomain: selected?.domain,
      lastUpdated: detail?.retrievedAt
    });

    const selectedContext: PublicEntityContext | undefined = detail
      ? {
          id: `ctx_${crypto.randomUUID()}`,
          contactId: body.contactId ?? null,
          provider: "cala",
          providerEntityId: detail.providerEntityId,
          entityType: detail.entityType,
          canonicalName: detail.canonicalName,
          rawContext: detail.rawContext,
          retrievedAt: detail.retrievedAt,
          confidence: entityResolution.score
        }
      : undefined;

    const sourceRecords = selectedContext
      ? [
          createSourceRecord({
            provider: "cala",
            sourceType: "cala_verified_fact",
            contactId: body.contactId ?? null,
            sourceName: selectedContext.canonicalName,
            retrievedAt: selectedContext.retrievedAt,
            notes: "Cala debug enrichment route"
          })
        ]
      : [];

    return jsonResponse({
      available: Boolean(selectedContext),
      candidates,
      selectedContext,
      entityMatchConfidence: entityResolution.score,
      sourceRecords,
      warnings: selectedContext ? [] : ["Cala returned no matching context."]
    });
  } catch (error) {
    return errorResponse(error);
  }
}
