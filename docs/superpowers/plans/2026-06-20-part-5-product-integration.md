# Part 5 Product Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Part 5 the daily cross-contact policy layer for the Brief, Radar, Board, and Person screens.

**Architecture:** Keep Parts 1-3 as producers. Add a read-only Part 5 adapter that reconstructs `RelationshipMoveInput` from persisted recommendations, conversations, atoms, evidence bundles, contacts, and outcomes. Frontend server view models consume Part 5 daily decisions and continue using existing components with additive fields.

**Tech Stack:** Next.js server components, TypeScript, Vitest, existing local JSON store.

---

### Task 1: Adapter And Read-Only Store Access

**Files:**
- Modify: `lib/db/queries.ts`
- Create: `lib/intelligence/layer5/adapters.ts`
- Test: `tests/relationshipDeltaIntegration.test.ts`

- [ ] Write failing tests proving live DB records become `RelationshipMoveInput` values.
- [ ] Add read-only evidence bundle lookup helpers.
- [ ] Implement adapter with safe fallbacks for missing atoms, evidence, recommendation, and contact fields.
- [ ] Run targeted tests.

### Task 2: Daily UX View Models

**Files:**
- Modify: `lib/frontend/viewModels.ts`
- Test: `tests/relationshipDeltaIntegration.test.ts`

- [ ] Write failing tests for daily brief no filler, high-fit ranking, confirm-first state, waiting state, and person detail Part 5 explanations.
- [ ] Wire `selectDailyMoves(...)` into Brief, Radar, Board, and Person view model builders.
- [ ] Preserve demo fallback when no persisted recommendations exist.
- [ ] Run targeted tests.

### Task 3: Frontend Copy And Components

**Files:**
- Modify: `components/DailyBrief.tsx`
- Modify: `components/MissionRadar.tsx`
- Modify: `components/RelationshipBoard.tsx`
- Modify: `components/PersonIntelligence.tsx`
- Modify: `app/globals.css`

- [ ] Update visible labels to reflect Part 5 move policy: why now, cost of silence, confirm first, what to avoid.
- [ ] Avoid showing internal raw score traces.
- [ ] Keep existing navigation and user-controlled send/wait/snooze behavior.
- [ ] Run scoped lint.

### Task 4: Verification And Merge

**Files:**
- All touched files

- [ ] Run `npm test`.
- [ ] Run scoped lint for changed files.
- [ ] Run `npx tsc --noEmit`.
- [ ] Commit integration branch.
- [ ] Merge to `main` after verification.
