import { describe, expect, it } from "vitest";
import {
  buildEvidenceFact,
  factConfidence,
  factSafety,
} from "@/lib/intelligence/factConfidence";

const NOW_ISO = "2026-06-20T10:30:00.000Z";

describe("factConfidence", () => {
  it("is the product of its inputs", () => {
    const c = factConfidence({
      sourceConfidence: 0.8,
      entityMatchConfidence: 0.9,
      extractionConfidence: 0.8,
      freshness: 1,
      contradictionPenalty: 0,
    });
    expect(c).toBeCloseTo(0.8 * 0.9 * 0.8, 5);
  });

  it("is lowered by a contradiction penalty", () => {
    const base = factConfidence({
      sourceConfidence: 0.9,
      entityMatchConfidence: 0.9,
      extractionConfidence: 0.9,
      freshness: 1,
      contradictionPenalty: 0,
    });
    const penalized = factConfidence({
      sourceConfidence: 0.9,
      entityMatchConfidence: 0.9,
      extractionConfidence: 0.9,
      freshness: 1,
      contradictionPenalty: 0.5,
    });
    expect(penalized).toBeLessThan(base);
  });
});

describe("factSafety", () => {
  it("classifies by spec thresholds", () => {
    expect(factSafety(0.8)).toBe("safe_for_draft");
    expect(factSafety(0.75)).toBe("safe_for_draft");
    expect(factSafety(0.6)).toBe("scoring_only");
    expect(factSafety(0.45)).toBe("scoring_only");
    expect(factSafety(0.44)).toBe("needs_confirmation");
  });
});

describe("buildEvidenceFact", () => {
  it("does not mark a low-confidence fact as safe_for_draft", () => {
    const fact = buildEvidenceFact({
      id: "f1",
      conversationId: "conv1",
      fact: "weak fact",
      sourceType: "search_snippet",
      entityMatchConfidence: 0.4,
      sourceConfidence: 0.45,
      extractionConfidence: 0.5,
      freshness: 1,
      createdAt: NOW_ISO,
    });
    expect(fact.factConfidence).toBeLessThan(0.45);
    expect(fact.safeForDraft).toBe(false);
  });

  it("marks a strong Cala-grade fact as safe_for_draft", () => {
    const fact = buildEvidenceFact({
      id: "f2",
      conversationId: "conv1",
      fact: "Recursive closed a Series A.",
      sourceType: "cala_verified_fact",
      entityMatchConfidence: 0.95,
      sourceConfidence: 0.9,
      extractionConfidence: 0.95,
      freshness: 1,
      createdAt: NOW_ISO,
      allowDraftSafe: true,
    });
    expect(fact.factConfidence).toBeGreaterThanOrEqual(0.75);
    expect(fact.safeForDraft).toBe(true);
  });

  it("rates a web fact lower than a Cala fact and never auto-draft-safe", () => {
    const cala = buildEvidenceFact({
      id: "c",
      conversationId: "conv1",
      fact: "Recursive is in applied AI.",
      sourceType: "cala_verified_fact",
      entityMatchConfidence: 0.9,
      sourceConfidence: 0.9,
      extractionConfidence: 0.9,
      freshness: 1,
      createdAt: NOW_ISO,
      allowDraftSafe: true,
    });
    const web = buildEvidenceFact({
      id: "w",
      conversationId: "conv1",
      fact: "Recursive expanding in Europe.",
      sourceType: "reputable_news",
      entityMatchConfidence: 0.6,
      sourceConfidence: 0.7,
      extractionConfidence: 0.6,
      freshness: 1,
      createdAt: NOW_ISO,
      allowDraftSafe: false,
    });
    expect(web.factConfidence).toBeLessThan(cala.factConfidence);
    expect(web.safeForDraft).toBe(false);
  });

  it("never marks a sensitive fact as safe_for_draft", () => {
    const fact = buildEvidenceFact({
      id: "s",
      conversationId: "conv1",
      fact: "personal/sensitive detail",
      sourceType: "cala_verified_fact",
      entityMatchConfidence: 0.95,
      sourceConfidence: 0.95,
      extractionConfidence: 0.95,
      freshness: 1,
      createdAt: NOW_ISO,
      isSensitive: true,
      allowDraftSafe: true,
    });
    expect(fact.safeForDraft).toBe(false);
  });
});
