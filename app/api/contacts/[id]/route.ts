import {
  deleteContact,
  getActiveObjective,
  getContact,
  listEvidenceBundles,
  saveEvidenceBundle,
  saveEvidenceFacts,
  saveSourceRecord,
  updateContactDetails,
} from "@/lib/db/queries";
import { buildEvidenceFact } from "@/lib/intelligence/factConfidence";
import { recommendNextAction } from "@/lib/intelligence/recommend";
import { createSourceRecord } from "@/lib/intelligence/sourceConfidence";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requiredString,
} from "@/lib/server/http";
import type {
  ContactConfirmationRequest,
  ContactConfirmationResponse,
  ContactDeleteResponse,
  EvidenceFact,
} from "@/lib/types";
import { deterministicId } from "@/lib/utils";

export const runtime = "nodejs";

interface ContactRouteContext {
  params: Promise<{ id: string }>;
}

function optionalField(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "VALIDATION_ERROR", `${field} must be text.`);
  const normalized = value.trim();
  if (normalized.length > 300) throw new HttpError(400, "VALIDATION_ERROR", `${field} is too long.`);
  return normalized || null;
}

export async function PATCH(request: Request, context: ContactRouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody<ContactConfirmationRequest>(request);
    const userId = requiredString(body.userId, "userId");
    const existing = getContact(id);
    if (!existing || existing.userId !== userId) {
      throw new HttpError(404, "CONTACT_NOT_FOUND", "Contact was not found.");
    }

    const candidate = {
      name: optionalField(body.name, "name"),
      role: optionalField(body.role, "role"),
      company: optionalField(body.company, "company"),
      email: optionalField(body.email, "email"),
      phone: optionalField(body.phone, "phone"),
      website: optionalField(body.website, "website"),
      linkedinUrl: optionalField(body.linkedinUrl, "linkedinUrl"),
    };
    if (!candidate.name && !candidate.company) {
      throw new HttpError(400, "VALIDATION_ERROR", "Confirm at least a name or company.");
    }

    const contact = updateContactDetails({
      contactId: id,
      userId,
      candidate,
      entityMatchConfidence: 1,
    });
    if (!contact) throw new HttpError(404, "CONTACT_NOT_FOUND", "Contact was not found.");

    const now = new Date();
    const nowIso = now.toISOString();
    const source = createSourceRecord({
      id: deterministicId("src", `confirmed:${id}`),
      contactId: id,
      provider: "manual",
      sourceType: "user_confirmed",
      sourceName: "User-confirmed contact details",
      retrievedAt: nowIso,
      notes: "Identity details reviewed and confirmed by the user.",
      now,
      crossAgreement: 1,
    });
    saveSourceRecord(source);

    const identityText = [
      candidate.name,
      candidate.role && candidate.company
        ? `${candidate.role} at ${candidate.company}`
        : candidate.role ?? candidate.company,
    ].filter(Boolean).join(", ");
    const latestBundle = [...listEvidenceBundles(userId)]
      .reverse()
      .find((bundle) => bundle.contactId === id);
    const conversationId = latestBundle?.conversationId ?? `confirmed_${id}`;
    const facts: EvidenceFact[] = [
      buildEvidenceFact({
        id: deterministicId("fact", `confirmed:${id}:identity`),
        contactId: id,
        conversationId,
        fact: identityText,
        factType: "confirmed_identity",
        sourceRecordId: source.id,
        sourceType: "user_confirmed",
        entityMatchConfidence: 1,
        sourceConfidence: source.sourceConfidence,
        extractionConfidence: 1,
        freshness: 1,
        createdAt: nowIso,
        allowDraftSafe: true,
      }),
    ];
    saveEvidenceFacts(facts);

    let recommendationPackage;
    const objective = await getActiveObjective(userId);
    if (latestBundle && objective) {
      const confirmedBundle = {
        ...latestBundle,
        contactCandidate: candidate,
        sourceRecords: [
          ...latestBundle.sourceRecords.filter((record) => record.id !== source.id),
          source,
        ],
        evidenceFacts: [
          ...latestBundle.evidenceFacts.filter((fact) => fact.id !== facts[0].id),
          ...facts,
        ],
        entityResolution: {
          capturedName: candidate.name ?? undefined,
          capturedCompany: candidate.company ?? undefined,
          capturedRole: candidate.role ?? undefined,
          capturedDomain: candidate.website ?? candidate.email ?? undefined,
          candidateName: candidate.name ?? undefined,
          candidateCompany: candidate.company ?? undefined,
          candidateRole: candidate.role ?? undefined,
          candidateDomain: candidate.website ?? candidate.email ?? undefined,
          score: 1,
          label: "high" as const,
          needsUserConfirmation: false,
          reasons: ["Identity details were confirmed by the user."],
        },
      };
      saveEvidenceBundle(confirmedBundle);
      recommendationPackage = await recommendNextAction({
        evidenceBundle: confirmedBundle,
        objective,
        now,
      });
    }

    return jsonResponse<ContactConfirmationResponse>({ contact, recommendationPackage });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: ContactRouteContext) {
  try {
    const { id } = await context.params;
    const userId = requiredString(new URL(request.url).searchParams.get("userId"), "userId");
    if (!deleteContact(id, userId)) {
      throw new HttpError(404, "CONTACT_NOT_FOUND", "Contact was not found.");
    }
    return jsonResponse<ContactDeleteResponse>({ deleted: true, contactId: id });
  } catch (error) {
    return errorResponse(error);
  }
}
