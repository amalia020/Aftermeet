import { describe, expect, it } from "vitest";
import type { SourceRecord } from "@/lib/types";
import {
  SOURCE_PRIORS,
  sourceConfidence,
  sourceTypeFromDomain,
} from "@/lib/intelligence/sourceConfidence";

const NOW = new Date("2026-06-20T10:30:00.000Z");

function record(overrides: Partial<SourceRecord>): SourceRecord {
  return {
    id: "src_test",
    contactId: "contact_test",
    provider: "conversation",
    sourceType: "user_voice_note",
    sourceName: null,
    sourceUrl: null,
    retrievedAt: NOW.toISOString(),
    sourceConfidence: 0,
    notes: null,
    ...overrides,
  };
}

describe("SOURCE_PRIORS", () => {
  it("ranks structured/verified sources above search snippets and unknown", () => {
    expect(SOURCE_PRIORS.business_card).toBeGreaterThan(SOURCE_PRIORS.search_snippet);
    expect(SOURCE_PRIORS.cala_verified_fact).toBeGreaterThan(SOURCE_PRIORS.search_snippet);
    expect(SOURCE_PRIORS.search_snippet).toBeGreaterThan(SOURCE_PRIORS.unknown);
    expect(SOURCE_PRIORS.unknown).toBe(0.2);
  });
});

describe("sourceConfidence", () => {
  it("scores a fresh business card high", () => {
    const c = sourceConfidence(
      record({ provider: "business_card", sourceType: "business_card" }),
      NOW,
    );
    expect(c).toBeGreaterThan(0.6);
  });

  it("scores a search snippet low", () => {
    const c = sourceConfidence(
      record({ provider: "web", sourceType: "search_snippet" }),
      NOW,
    );
    expect(c).toBeLessThan(0.55);
  });

  it("scores an unknown source the lowest", () => {
    const card = sourceConfidence(
      record({ provider: "business_card", sourceType: "business_card" }),
      NOW,
    );
    const snippet = sourceConfidence(
      record({ provider: "web", sourceType: "search_snippet" }),
      NOW,
    );
    const unknown = sourceConfidence(
      record({ provider: "manual", sourceType: "unknown" }),
      NOW,
    );
    expect(unknown).toBeLessThan(snippet);
    expect(snippet).toBeLessThan(card);
  });

  it("rewards a cited URL via provenance", () => {
    const withUrl = sourceConfidence(
      record({ sourceType: "reputable_news", sourceUrl: "https://reuters.com/x" }),
      NOW,
    );
    const withoutUrl = sourceConfidence(
      record({ sourceType: "reputable_news", sourceUrl: null }),
      NOW,
    );
    expect(withUrl).toBeGreaterThan(withoutUrl);
  });

  it("is deterministic for identical inputs", () => {
    const r = record({ provider: "cala", sourceType: "cala_verified_fact" });
    expect(sourceConfidence(r, NOW)).toBe(sourceConfidence(r, NOW));
  });
});

describe("sourceTypeFromDomain", () => {
  it("classifies reputable news", () => {
    expect(sourceTypeFromDomain("https://techcrunch.com/2026/series-a")).toBe(
      "reputable_news",
    );
  });
  it("classifies fund websites", () => {
    expect(sourceTypeFromDomain("https://foundersfund.vc/portfolio")).toBe(
      "fund_website",
    );
  });
  it("classifies a bare company domain as company_website", () => {
    expect(sourceTypeFromDomain("https://recursive.ai")).toBe("company_website");
  });
  it("falls back to search_snippet for unrecognized deep links", () => {
    expect(
      sourceTypeFromDomain("https://random-aggregator.example/q?a=1&b=2&c=3"),
    ).toBe("search_snippet");
  });
});
