import { describe, expect, it } from "vitest";
import "./helpers";
import { entityMatchConfidence, entityMatchLabel } from "@/lib/intelligence/entityResolution";
import { factConfidence } from "@/lib/intelligence/factConfidence";
import { createSourceRecord, sourceConfidence } from "@/lib/intelligence/sourceConfidence";
import type { EvidenceFact } from "@/lib/types";

describe("deterministic confidence", () => {
  it("scores stronger source types above unknown sources", () => {
    const official = createSourceRecord({
      provider: "web",
      sourceType: "official_press",
      sourceUrl: "https://example.com/news",
      retrievedAt: new Date().toISOString()
    });
    const unknown = createSourceRecord({
      provider: "web",
      sourceType: "unknown",
      retrievedAt: "2020-01-01T00:00:00.000Z"
    });

    expect(sourceConfidence(official)).toBeGreaterThan(sourceConfidence(unknown));
  });

  it("labels exact company/domain matches as medium or better and ambiguous names as low", () => {
    const strong = entityMatchConfidence({
      capturedName: "Maya Linden",
      capturedCompany: "Recursive",
      capturedDomain: "recursive.example",
      candidateName: "Maya Linden",
      candidateCompany: "Recursive",
      candidateDomain: "recursive.example"
    });
    const weak = entityMatchConfidence({
      capturedName: "Maya",
      candidateName: "Maya",
      candidateCompany: "Unknown"
    });

    expect(entityMatchLabel(strong)).toMatch(/high|medium/);
    expect(entityMatchLabel(weak)).toMatch(/low|no_match/);
  });

  it("applies fact confidence thresholds and contradiction penalties", () => {
    const base: EvidenceFact = {
      id: "fact_test",
      conversationId: "conv_test",
      fact: "Recursive announced a Series A.",
      factType: "funding",
      sourceRecordId: "src_test",
      sourceType: "official_press",
      entityMatchConfidence: 0.95,
      sourceConfidence: 0.95,
      extractionConfidence: 0.95,
      freshness: 0.95,
      contradictionPenalty: 0,
      factConfidence: 0,
      safeForDraft: false,
      isProfessional: true,
      isSensitive: false,
      createdAt: new Date().toISOString()
    };

    const high = factConfidence(base);
    const penalized = factConfidence({ ...base, contradictionPenalty: 0.6 });

    expect(high).toBeGreaterThanOrEqual(0.75);
    expect(penalized).toBeLessThan(0.45);
  });
});
