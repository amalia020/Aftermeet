import { describe, expect, it, vi } from "vitest";
import "./helpers";
import { createConversation, saveConversationAtoms, setConversationContact, upsertContactFromCandidate } from "@/lib/db/queries";
import { enrichEvidence } from "@/lib/intelligence/enrichment";
import { demoConversationText, demoExtractionProviderResult, demoExtractionResult, demoObjective, DEMO_USER_ID } from "@/lib/demo/fixtures";
import type { ExtractionHandoff } from "@/lib/types";

async function demoHandoff(): Promise<ExtractionHandoff> {
  const conversation = await createConversation({
    userId: DEMO_USER_ID,
    rawText: demoConversationText,
    captureType: "text"
  });
  const contact = await upsertContactFromCandidate({
    userId: DEMO_USER_ID,
    candidate: demoExtractionResult.contactCandidate,
    sourceType: "manual"
  });
  if (contact) await setConversationContact(conversation.id, contact.id);
  const updatedConversation = { ...conversation, contactId: contact?.id ?? null };
  await saveConversationAtoms({
    conversationId: updatedConversation.id,
    atoms: demoExtractionResult.atoms
  });

  return {
    requestId: "req_test_enrichment",
    userId: DEMO_USER_ID,
    objective: demoObjective,
    conversation: updatedConversation,
    contactCandidate: demoExtractionResult.contactCandidate,
    atoms: demoExtractionResult.atoms,
    opportunityHints: demoExtractionResult.opportunityHints,
    extraction: demoExtractionProviderResult,
    sourceRecord: {
      provider: "conversation",
      sourceType: "manual",
      retrievedAt: updatedConversation.capturedAt,
      sourceConfidence: 0.78
    }
  };
}

describe("enrichment coordinator", () => {
  it("attempts Cala before returning source-backed evidence", async () => {
    const bundle = await enrichEvidence(await demoHandoff());

    expect(bundle.enrichment.attempted).toBe(true);
    expect(bundle.enrichment.calaAttempted).toBe(true);
    expect(bundle.sourceRecords.some((source) => source.provider === "cala")).toBe(true);
    expect(bundle.evidenceFacts.length).toBeGreaterThan(0);
    expect(bundle.evidenceFacts.every((fact) => fact.factConfidence >= 0)).toBe(true);
  });

  it("continues with conversation evidence when providers have no public context", async () => {
    const handoff = await demoHandoff();
    handoff.contactCandidate = { name: "Unknown Person", company: "NoMatchCo" };
    handoff.opportunityHints = [{ route: "user", score: 0.8, evidence: ["important"] }];

    const bundle = await enrichEvidence(handoff);

    expect(bundle.enrichment.status).toBe("public_context_unavailable");
    expect(bundle.evidenceFacts.length).toBeGreaterThan(0);
    expect(bundle.publicContext).toEqual([]);
  });

  it("retains uncited web claims as low-confidence context", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Fallback context",
                      available: true,
                      claims: [
                        { text: "No citation claim" },
                        { text: "Cited claim", sourceUrl: "https://example.com/news" }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      )
    );
    const handoff = await demoHandoff();
    handoff.contactCandidate = { name: "Alex", company: "NoMatchCo" };
    handoff.opportunityHints = [{ route: "user", score: 0.8, evidence: ["important"] }];

    const bundle = await enrichEvidence(handoff);

    expect(bundle.enrichment.webFallbackAttempted).toBe(true);
    expect(bundle.enrichment.warnings.join(" ")).toContain("may be inaccurate");
    expect(bundle.sourceRecords.filter((source) => source.provider === "web")).toHaveLength(2);
    const uncitedFact = bundle.evidenceFacts.find((fact) => fact.fact === "No citation claim");
    expect(uncitedFact?.sourceType).toBe("unknown");
    expect(uncitedFact?.safeForDraft).toBe(false);
    expect(uncitedFact?.extractionConfidence).toBe(0.35);
    expect(bundle.enrichment.warnings.join(" ")).toContain(
      "retained as low-confidence context"
    );
    vi.unstubAllGlobals();
  });
});
