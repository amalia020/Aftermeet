import { afterEach, describe, expect, it, vi } from "vitest";
import {
  geminiWebContext,
  parseGroundedGeminiCandidate
} from "@/lib/providers/gemini";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

describe("parseGroundedGeminiCandidate", () => {
  it("turns Google Search grounding supports into cited claims", () => {
    const result = parseGroundedGeminiCandidate(
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                summary: "Jazzley Louisville is a software engineer and founder.",
                claims: [
                  { text: "Jazzley Louisville founded EkkoTech." }
                ],
                available: true
              })
            }
          ]
        },
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: "https://ekkotech.nl", title: "EkkoTech" } }
          ],
          groundingSupports: [
            {
              segment: { text: "Jazzley Louisville founded EkkoTech." },
              groundingChunkIndices: [0]
            }
          ]
        }
      },
      "2026-06-20T00:00:00.000Z"
    );

    expect(result?.available).toBe(true);
    expect(result?.claims).toEqual([
      expect.objectContaining({
        text: "Jazzley Louisville founded EkkoTech.",
        sourceUrl: "https://ekkotech.nl"
      })
    ]);
  });

  it("uses clean structured claims instead of JSON-laced grounding blobs", () => {
    const jsonText = JSON.stringify({
      summary:
        "She specializes in building digital solutions for organizations and AI research.",
      claims: [
        "Amalia Stuger works as a Web Developer, AI Expert, and Project Manager [2.1.2].",
        "She is affiliated with the University of Amsterdam."
      ],
      available: true
    });

    const result = parseGroundedGeminiCandidate({
      content: { parts: [{ text: jsonText }] },
      groundingMetadata: {
        groundingChunks: [{ web: { uri: "https://uva.nl" } }],
        // Grounding segment is a raw substring of the JSON payload — must NOT
        // become a fact verbatim.
        groundingSupports: [
          {
            segment: { text: 'AI research.", "claims": [ "Amalia Stuger works as a Web Developer' },
            groundingChunkIndices: [0]
          }
        ]
      }
    });

    expect(result?.claims).toHaveLength(2);
    expect(result?.claims[0].text).toBe(
      "Amalia Stuger works as a Web Developer, AI Expert, and Project Manager."
    );
    expect(result?.claims[1].text).toBe("She is affiliated with the University of Amsterdam.");
    for (const claim of result?.claims ?? []) {
      expect(claim.text).not.toContain('"claims"');
      expect(claim.text).not.toContain("[2.1.2]");
    }
  });
});

describe("geminiWebContext", () => {
  it("aborts grounded search after one total timeout budget", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })
    );

    const startedAt = Date.now();
    const result = await geminiWebContext({
      name: "Alex",
      query: "Alex professional context",
      timeoutMs: 10
    });

    expect(result.available).toBe(false);
    expect(result.claims).toEqual([]);
    expect(result.warnings?.join(" ")).toContain("timed out after 10ms");
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
