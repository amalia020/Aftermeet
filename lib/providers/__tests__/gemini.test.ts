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
