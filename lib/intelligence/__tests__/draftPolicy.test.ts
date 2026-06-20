import { describe, expect, it } from "vitest";
import { factsAllowedInDraft } from "../draftPolicy";
import type { EvidenceFact } from "@/lib/types";

function fact(overrides: Partial<EvidenceFact>): EvidenceFact {
  return {
    id: "f",
    conversationId: "conv",
    fact: "A professional fact.",
    sourceType: "cala_verified_fact",
    entityMatchConfidence: 0.9,
    sourceConfidence: 0.9,
    extractionConfidence: 0.9,
    freshness: 1,
    contradictionPenalty: 0,
    factConfidence: 0.9,
    safeForDraft: true,
    isProfessional: true,
    isSensitive: false,
    createdAt: "2026-06-20T10:30:00.000Z",
    ...overrides,
  };
}

describe("factsAllowedInDraft", () => {
  it("keeps a high-confidence, professional, non-sensitive, known-source fact", () => {
    const result = factsAllowedInDraft([fact({ id: "ok" })]);
    expect(result.map((f) => f.id)).toEqual(["ok"]);
  });

  it("filters low-confidence facts (< 0.75)", () => {
    const result = factsAllowedInDraft([fact({ id: "low", factConfidence: 0.5 })]);
    expect(result).toHaveLength(0);
  });

  it("filters sensitive facts", () => {
    const result = factsAllowedInDraft([fact({ id: "sensitive", isSensitive: true })]);
    expect(result).toHaveLength(0);
  });

  it("filters non-professional facts", () => {
    const result = factsAllowedInDraft([fact({ id: "personal", isProfessional: false })]);
    expect(result).toHaveLength(0);
  });

  it("filters unknown-source facts", () => {
    const result = factsAllowedInDraft([fact({ id: "unknown", sourceType: "unknown" })]);
    expect(result).toHaveLength(0);
  });

  it("filters a mixed list down to only the safe fact", () => {
    const result = factsAllowedInDraft([
      fact({ id: "ok" }),
      fact({ id: "low", factConfidence: 0.4 }),
      fact({ id: "sensitive", isSensitive: true }),
      fact({ id: "unknown", sourceType: "unknown" }),
    ]);
    expect(result.map((f) => f.id)).toEqual(["ok"]);
  });
});
