import { describe, expect, it, vi } from "vitest";
import "./helpers";
import { extractConversationAtomsDetailed } from "@/lib/intelligence/extraction";
import { demoObjective, demoConversationText } from "@/lib/demo/fixtures";

describe("conversation extraction", () => {
  it("returns the demo fixture for the Maya/Recursive narrative", async () => {
    const result = await extractConversationAtomsDetailed({
      rawText: demoConversationText,
      userObjective: demoObjective
    });

    expect(result.contactCandidate.company).toBe("Recursive");
    expect(result.atoms.facts.length).toBeGreaterThan(0);
    expect(result.providerResult.provider).toBe("fixture");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("draft:");
  });

  it("falls back safely after malformed Gemini JSON and retries once", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      Response.json({
        modelVersion: "gemini-test",
        candidates: [{ content: { parts: [{ text: "not-json" }] } }]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractConversationAtomsDetailed({
      rawText: "Met Alex from Orbit. They might be interested in a short pilot.",
      userObjective: demoObjective
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.providerResult.provider).toBe("fixture");
    expect(result.providerResult.warnings.join(" ")).toContain("parse failed");
    expect(result.atoms.uncertainties.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("keeps sensitive non-professional details out of extracted facts", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          modelVersion: "gemini-test",
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      contactCandidate: { name: "Rae", company: "Northstar" },
                      atoms: {
                        facts: [
                          { text: "Rae works at Northstar.", isProfessional: true },
                          { text: "Rae shared a medical detail.", isSensitive: true }
                        ],
                        asks: [],
                        offers: [],
                        commitments: [],
                        uncertainties: [],
                        extractionConfidence: 0.8
                      },
                      opportunityHints: []
                    })
                  }
                ]
              }
            }
          ]
        })
      )
    );

    const result = await extractConversationAtomsDetailed({
      rawText: "Met Rae from Northstar.",
      userObjective: demoObjective
    });

    expect(result.atoms.facts.map((fact) => fact.text)).toEqual(["Rae works at Northstar."]);
    vi.unstubAllGlobals();
  });
});
