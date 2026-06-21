import {
  deleteEvidenceFact,
  getContact,
  getEvidenceFact,
  listEvidenceBundles,
  saveEvidenceBundle,
} from "@/lib/db/queries";
import { errorResponse, HttpError, jsonResponse, requiredString } from "@/lib/server/http";
import type { EvidenceFactDeleteResponse } from "@/lib/types";

export const runtime = "nodejs";

interface EvidenceRouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: EvidenceRouteContext) {
  try {
    const { id } = await context.params;
    const userId = requiredString(new URL(request.url).searchParams.get("userId"), "userId");
    const fact = getEvidenceFact(id);
    const contact = fact?.contactId ? getContact(fact.contactId) : null;
    if (!fact || !contact || contact.userId !== userId) {
      throw new HttpError(404, "EVIDENCE_NOT_FOUND", "Evidence fact was not found.");
    }
    deleteEvidenceFact(id);
    for (const bundle of listEvidenceBundles(userId)) {
      if (bundle.contactId === contact.id && bundle.evidenceFacts.some((item) => item.id === id)) {
        saveEvidenceBundle({
          ...bundle,
          evidenceFacts: bundle.evidenceFacts.filter((item) => item.id !== id),
        });
      }
    }
    return jsonResponse<EvidenceFactDeleteResponse>({ deleted: true, factId: id });
  } catch (error) {
    return errorResponse(error);
  }
}
