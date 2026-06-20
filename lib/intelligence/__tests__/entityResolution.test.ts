import { describe, expect, it } from "vitest";
import {
  entityMatchConfidence,
  matchLabel,
  resolveEntity,
} from "@/lib/intelligence/entityResolution";

const NOW = new Date("2026-06-20T10:30:00.000Z");

describe("matchLabel", () => {
  it("maps scores to labels at the spec thresholds", () => {
    expect(matchLabel(0.8)).toBe("high");
    expect(matchLabel(0.75)).toBe("high");
    expect(matchLabel(0.5)).toBe("medium");
    expect(matchLabel(0.49)).toBe("low");
    expect(matchLabel(0.3)).toBe("low");
    expect(matchLabel(0.29)).toBe("no_match");
  });
});

describe("entityMatchConfidence", () => {
  it("scores an exact business-card-style match high", () => {
    const score = entityMatchConfidence({
      capturedName: "Maya Linden",
      capturedCompany: "Recursive",
      capturedRole: "Founder",
      capturedDomain: "recursive.ai",
      candidateName: "Maya Linden",
      candidateCompany: "Recursive",
      candidateRole: "Founder",
      candidateDomain: "recursive.ai",
      sourceAgreementScore: 0.8,
      lastUpdated: NOW.toISOString(),
      now: NOW,
    });
    expect(score).toBeGreaterThanOrEqual(0.75);
    expect(matchLabel(score)).toBe("high");
  });

  it("lowers confidence when company is missing", () => {
    const withCompany = entityMatchConfidence({
      capturedName: "Maya Linden",
      capturedCompany: "Recursive",
      candidateName: "Maya Linden",
      candidateCompany: "Recursive",
      now: NOW,
    });
    const withoutCompany = entityMatchConfidence({
      capturedName: "Maya Linden",
      candidateName: "Maya Linden",
      candidateCompany: "Recursive",
      now: NOW,
    });
    expect(withoutCompany).toBeLessThan(withCompany);
  });

  it("keeps common names without company at low / no_match", () => {
    const score = entityMatchConfidence({
      capturedName: "Maya",
      candidateName: "Maya",
      now: NOW,
    });
    // name (0.30) only; everything else 0 -> below medium.
    expect(score).toBeLessThan(0.5);
    expect(["low", "no_match"]).toContain(matchLabel(score));
  });
});

describe("resolveEntity", () => {
  it("flags ambiguous single-name-no-company as needing confirmation", () => {
    const summary = resolveEntity({
      capturedName: "Maya",
      candidateName: "Maya",
      now: NOW,
    });
    expect(summary.score).toBeLessThan(0.45);
    expect(summary.needsUserConfirmation).toBe(true);
    expect(summary.reasons.length).toBeGreaterThan(0);
  });

  it("does not require confirmation for a strong company match", () => {
    const summary = resolveEntity({
      capturedName: "Maya",
      capturedCompany: "Recursive",
      capturedDomain: "recursive.ai",
      candidateName: "Recursive",
      candidateCompany: "Recursive",
      candidateDomain: "recursive.ai",
      sourceAgreementScore: 0.7,
      lastUpdated: NOW.toISOString(),
      now: NOW,
    });
    expect(summary.needsUserConfirmation).toBe(false);
    expect(["medium", "high"]).toContain(summary.label);
  });

  it("reports no candidate when nothing was retrieved", () => {
    const summary = resolveEntity({
      capturedName: "Maya",
      capturedCompany: "Recursive",
      now: NOW,
    });
    expect(summary.label).toBe("no_match");
    expect(summary.needsUserConfirmation).toBe(true);
  });
});
