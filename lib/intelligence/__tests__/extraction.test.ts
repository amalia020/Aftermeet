/**
 * Extraction service tests (Part 1, Phase 26). Pure / no network.
 *
 * With no API keys configured the LLM transport returns a fallback outcome,
 * so extractConversationAtoms is exercised entirely against fixtures. These
 * tests assert the fallback shape is always valid and never throws on messy
 * input.
 */

import { describe, expect, it, vi } from "vitest";

// Guarantee demo mode regardless of the developer's local env.
vi.stubEnv("GEMINI_API_KEY", "");
vi.stubEnv("AFTERMEET_DEMO_MODE", "true");

import { extractConversationAtoms } from "@/lib/intelligence/extraction";
import { part1DemoObjective } from "@/lib/demo/savedExamples";
import type { ConversationAtomsExtractionResult } from "@/lib/types";

function assertValidShape(result: ConversationAtomsExtractionResult): void {
  expect(result).toBeTruthy();
  expect(result.contactCandidate).toBeTypeOf("object");
  expect(Array.isArray(result.atoms.facts)).toBe(true);
  expect(Array.isArray(result.atoms.asks)).toBe(true);
  expect(Array.isArray(result.atoms.offers)).toBe(true);
  expect(Array.isArray(result.atoms.commitments)).toBe(true);
  expect(Array.isArray(result.atoms.uncertainties)).toBe(true);
  expect(typeof result.atoms.extractionConfidence).toBe("number");
  expect(result.atoms.extractionConfidence).toBeGreaterThanOrEqual(0);
  expect(result.atoms.extractionConfidence).toBeLessThanOrEqual(1);
  expect(Array.isArray(result.opportunityHints)).toBe(true);
}

describe("extractConversationAtoms (fixture mode)", () => {
  it("handles an empty string without throwing and yields an empty extraction", async () => {
    const { result, extraction } = await extractConversationAtoms({
      rawText: "",
      userObjective: part1DemoObjective,
    });
    assertValidShape(result);
    expect(extraction.provider).toBe("fixture");
    expect(result.atoms.facts).toHaveLength(0);
    expect(result.contactCandidate.name).toBeNull();
    expect(result.atoms.uncertainties.length).toBeGreaterThan(0);
    expect(result.atoms.extractionConfidence).toBe(0);
  });

  it("handles whitespace-only input as empty", async () => {
    const { result, extraction } = await extractConversationAtoms({
      rawText: "   \n\t  ",
      userObjective: part1DemoObjective,
    });
    assertValidShape(result);
    expect(extraction.provider).toBe("fixture");
    expect(result.atoms.facts).toHaveLength(0);
  });

  it("handles prose with no contact details and returns a valid shape", async () => {
    const { result, extraction } = await extractConversationAtoms({
      rawText:
        "Had a long, rambling chat about the weather and the conference food. Nothing concrete came of it and no names were exchanged.",
      userObjective: part1DemoObjective,
    });
    assertValidShape(result);
    // In fixture mode, non-empty input falls back to the demo extraction shape.
    expect(extraction.provider).toBe("fixture");
    expect(extraction.warnings.length).toBeGreaterThan(0);
  });

  it("returns the labelled fixture provider with extraction confidence in range", async () => {
    const { result, extraction } = await extractConversationAtoms({
      rawText: "Met someone interesting from a startup.",
      userObjective: part1DemoObjective,
    });
    assertValidShape(result);
    expect(extraction.provider).toBe("fixture");
    expect(extraction.model).toBe("demo");
    expect(extraction.extractionConfidence).toBe(
      result.atoms.extractionConfidence,
    );
  });

  it("does not include any draft/follow-up text fields in the output", async () => {
    const { result } = await extractConversationAtoms({
      rawText: "Quick hallway chat, said they'd love a follow up.",
      userObjective: part1DemoObjective,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/"draft"/i);
    expect(serialized).not.toMatch(/"body"\s*:/i);
    expect(serialized).not.toMatch(/"subject"\s*:/i);
  });

  it("never mutates the shared fixture between calls", async () => {
    const first = await extractConversationAtoms({
      rawText: "First conversation.",
      userObjective: part1DemoObjective,
    });
    first.result.atoms.facts.push({ text: "mutation attempt" });

    const second = await extractConversationAtoms({
      rawText: "Second conversation.",
      userObjective: part1DemoObjective,
    });
    expect(
      second.result.atoms.facts.some((f) => f.text === "mutation attempt"),
    ).toBe(false);
  });
});
