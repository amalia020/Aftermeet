# Part 5 Relationship Delta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic Relationship Delta, Cost of Silence, action gating, and daily move selection engine from the Part 5 SDD.

**Architecture:** Add additive contracts in `lib/types`, then implement pure modules under `lib/intelligence/layer5`. The engine consumes existing Part 1-3 contracts when available, keeps score traces internal, and exposes a frontend-safe daily move view.

**Tech Stack:** TypeScript, Vitest, existing `@/lib/types` and `@/lib/intelligence/utils` helpers.

---

### Task 1: Contracts And Normalizers

**Files:**
- Modify: `lib/types/common.ts`
- Create: `lib/types/relationshipDelta.ts`
- Modify: `lib/types/index.ts`
- Create: `lib/intelligence/layer5/constants.ts`
- Create: `lib/intelligence/layer5/normalizers.ts`
- Test: `tests/relationshipDelta.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import "./helpers";
import { normalizeEnumScore, scoreFeature } from "@/lib/intelligence/layer5/normalizers";
import { ASK_SIZE_BY_ACTION } from "@/lib/intelligence/layer5/constants";

describe("relationship delta normalizers", () => {
  it("maps known action ask sizes and clamps unknown values", () => {
    expect(ASK_SIZE_BY_ACTION.ask_for_investment).toBe(0.9);
    expect(normalizeEnumScore({ exact: 1 }, "missing", 0.3)).toBe(0.3);
    expect(normalizeEnumScore({ tooHigh: 3 }, "tooHigh", 0)).toBe(1);
  });

  it("creates traceable score features", () => {
    expect(scoreFeature({
      key: "permissionStrength",
      source: "conversation",
      rawValue: "explicit_request",
      normalizedValue: 1.4,
      confidence: 0.8,
      reason: "Contact explicitly asked for follow-up."
    })).toMatchObject({
      key: "permissionStrength",
      normalizedValue: 1,
      confidence: 0.8
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: FAIL because `lib/intelligence/layer5/normalizers` does not exist.

- [ ] **Step 3: Implement contracts and normalizers**

Create additive Part 5 types, export them from `lib/types/index.ts`, add `part_5_relationship_delta` to `WorkstreamOwner`, and implement constants/normalizers with clamped scores.

- [ ] **Step 4: Run green test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: PASS.

### Task 2: Feature Scoring And Relationship State

**Files:**
- Create: `lib/intelligence/layer5/features.ts`
- Create: `lib/intelligence/layer5/relationshipState.ts`
- Modify: `tests/relationshipDelta.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for high-confidence evidence, low identity confidence, warm explicit follow-up, and state resolution to `blocked`, `waiting`, `warm`, `cooling`, and `dormant`.

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: FAIL because feature scorers and resolver do not exist.

- [ ] **Step 3: Implement feature scorers**

Implement deterministic score functions for mission impact, relationship fit, strategic scarcity, warmth, clarity, reciprocity, timing, evidence confidence, and risk.

- [ ] **Step 4: Run green test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: PASS.

### Task 3: Delta, Actions, And Daily Selector

**Files:**
- Create: `lib/intelligence/layer5/relationshipDelta.ts`
- Create: `lib/intelligence/layer5/candidateActions.ts`
- Create: `lib/intelligence/layer5/actionScoring.ts`
- Create: `lib/intelligence/layer5/dailyMoveSelector.ts`
- Create: `lib/intelligence/layer5/explanations.ts`
- Create: `lib/intelligence/layer5/index.ts`
- Modify: `tests/relationshipDelta.test.ts`

- [ ] **Step 1: Write failing tests**

Add golden tests for fresh high-fit follow-up winning, low identity confidence producing `confirm_details`, recent no-response suppressing another nudge, public-only sensitive facts being blocked, attention budget limits, and no low-priority filler.

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: FAIL because the selector and action scoring do not exist.

- [ ] **Step 3: Implement scoring pipeline**

Compute relationship delta, cost of silence, daily priority, action candidates, hard gates, explanations, frontend-safe view conversion, and daily diversification.

- [ ] **Step 4: Run green test**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- All Part 5 files

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- tests/relationshipDelta.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full suite**

Run: `npm test`
Expected: 5 files pass, all tests pass.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no lint errors.
