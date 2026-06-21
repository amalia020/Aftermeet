# Session log — Loops, enrichment, B2C copy pass

Date: 2026-06-21
Scope: frontend view models, contact intelligence screen, Part 2 enrichment pipeline,
consumer-facing copy. All work validated with `npx tsc --noEmit`, `npx vitest run`
(110 tests passing), and `npx next lint` on changed files.

---

## 1. Loops screen — real empty state instead of demo data

**Problem:** the Loops tab (`/traction`) always showed fabricated values. When there were
no live recommendations, `getOutcomeLoopViewModel` fell back to `demoOutcomeWithTypes()`
(fake contact "Elena", summary 18/11/5/27) with no `target`, so buttons were silently
disabled.

**Fix:**
- Replaced the demo fallback with `emptyOutcomeLoop()` → `state: "empty"`, real
  `summary` from `tractionSummary(userId)`.
- [components/OutcomeLoop.tsx](../components/OutcomeLoop.tsx) renders an explicit empty
  view (muted hero + real traction strip) for `state === "empty"`.
- De-duplicated the option list into a shared builder.

## 2. Outcome buttons tailored by opportunity type + all fake content removed

**Outcome buttons:** `OUTCOME_LABELS_BY_TYPE` + `outcomeLoopOptions(opportunityType)` in
[lib/frontend/viewModels.ts](../lib/frontend/viewModels.ts). Underlying `OutcomeType`
values are unchanged (persistence/stats unaffected); only labels adapt — e.g. hiring loop
shows *Interview booked → Hired*, raise shows *Pitch booked → Soft commit → Committed*.
`OutcomeLoop` maps icons by `outcomeType` (variable-length option list).

**Removed ALL demo/mock fallbacks (user: "do not fake anything for the demo"):**
- Deleted `lib/frontend/mockData.ts`.
- Daily Brief, Mission Radar, Relationship Board, Person Intelligence each now return
  genuine empty states (no fabricated nodes/cards/contacts).
- `getPersonIntelligenceViewModel` → `emptyPerson()` (`state: "empty"`);
  [components/PersonIntelligence.tsx](../components/PersonIntelligence.tsx) renders a real
  empty view.

## 3. Attention budget (Q&A only, no code)

The `attentionBudgetToday` cap (`DEFAULT_ATTENTION_BUDGET = 3`, profile default 5) limits
how many daily moves the brief surfaces — an anti-overwhelm mechanism applied as the final
`.slice(0, budget)` in `selectDailyMoves`.

## 4. Parallel Cala + Gemini enrichment with LLM combine

**Problem:** Gemini ran only as a *sequential fallback* gated on low Cala confidence; a
borderline Cala match + a Gemini timeout left the profile empty.

**Fix in [lib/intelligence/enrichment.ts](../lib/intelligence/enrichment.ts):**
- Cala and Gemini now run **concurrently** (`Promise.all`); a slow web call never blocks
  Cala data and vice versa.
- Provenance preserved: per-provider source records + evidence facts (Cala
  `cala_verified_fact` draft-safe; web claims context-only).
- `synthesizeEvidenceProfile()` uses `requestGeminiJson` to merge Cala facts + web claims +
  captured notes into one structured profile, with a deterministic merge fallback so a
  model timeout never loses data.
- Helpers extracted: `enrichViaCala`, `collectCalaFacts`, `collectWebFacts`.

## 5. Cala 50% threshold restored, Gemini timeout fixed, cohesive profile card

- **Confidence is Cala-only** → restored the `MEDIUM_THRESHOLD = 0.5` gate (removed the
  temporary 0.25 context threshold). Below 50%, Cala is ignored and we rely on the awaited
  Gemini context.
- **Timeout:** `WEB_CONTEXT_TIMEOUT_MS = 45_000` (was 15s) — we now wait on Gemini.
- **Cohesive contact screen:** added shared `EvidenceProfile` type
  ([lib/types/context.ts](../lib/types/context.ts)). The contact screen renders ONE
  synthesized card (summary + structured attributes + expertise/highlights/signals +
  a "Synthesized from …" provenance footer) via `EvidenceProfileCard`, instead of one card
  per raw fact. View model reads the stored synthesis (`readStoredProfile`) with a
  deterministic fallback. Per-fact provenance/draft-safety still intact underneath.

## 6. Full B2C copy pass — no technical terms in the UI

**New hub: [lib/copy.ts](../lib/copy.ts)** — `CAPTURE_STAGE_LABELS`/`captureStageLabel`,
`friendlyWarnings` (drops diagnostics, rewrites meaningful warnings, strips any surviving
vendor name as a safety net), `confidenceLevel`/`CONFIDENCE_LABELS`.

By tier:
- **Tier 1 — vendor names:** removed Cala/Gemini/OpenAI/Whisper/WebRTC from source names,
  warnings, transcript statuses.
- **Tier 2 — capture flow:** stage pills now read "Reading your note", "Finding who this
  is", etc., instead of `persisting_atoms`/`resolving_entity`.
- **Tier 3 — architecture vocabulary:** "Evidence trace" → "What we know", "Draft policy" →
  "What to mention", dropped "Part 5 daily policy"/"Signal ledger"/"decision engine", etc.
- **Tier 4 — raw confidence numbers:** the 4-cell Entity/Sources/Facts/Final grid replaced
  by a single qualitative **trust badge**; capture result drops raw Confidence/Priority %.
- **Tier 5 — acronyms/jargon:** WTP → "They'd pay", "cost of silence" → "Worth reaching out
  soon"/…, "recipient burden" reworded, "Attention budget" → "People to focus on each day",
  nav "Loops" → "Results".
- **Tier 6 — leaked Cala query:** [lib/providers/cala.ts](../lib/providers/cala.ts)
  `calaKnowledgeQuery` no longer echoes the raw question template back as a fact.

Left intentionally: OpenAPI/Swagger docs and internal `expectedSignal`/`suggestedAction`
route fields (never rendered in the consumer app).

## 7. JSON-blob leak in "Avoid mentioning" facts

**Problem:** facts showed raw JSON (`…intelligence.", "claims": [ "Amalia…`) as huge,
duplicated walls of text.

**Root causes + fixes in [lib/providers/gemini.ts](../lib/providers/gemini.ts):**
1. `parseGeminiJson` rejected string claims (model returns `"claims": ["…"]` as strings) —
   now accepts both strings and `{text}` objects.
2. The fallback scraped raw grounding-segment JSON substrings — `parseGroundedGeminiCandidate`
   now prefers structured claims, attaches citations positionally, and only falls back to
   grounding segments (cleaned) when no JSON; claims are de-duplicated.

**Defense-in-depth:** `tidyFact`/`tidyFacts` in [lib/copy.ts](../lib/copy.ts) strip JSON
scaffolding + citation markers, cap length per item, dedupe, and cap count — applied to
`safeFacts`/`blockedFacts` and the profile fields in the view model (also cleans
already-stored data). Regression test added in
[lib/providers/__tests__/gemini.test.ts](../lib/providers/__tests__/gemini.test.ts).

---

## Key files touched

- `lib/copy.ts` (new) — central consumer-facing copy hub
- `lib/frontend/viewModels.ts` — empty states, cohesive profile, tidy facts, friendly warnings
- `lib/intelligence/enrichment.ts` — parallel providers + profile synthesis
- `lib/providers/gemini.ts` — claim parsing fix
- `lib/providers/cala.ts` — leaked-query fix
- `lib/types/context.ts` — `EvidenceProfile` type
- `components/` — OutcomeLoop, PersonIntelligence, MissionRadar, CaptureSignal, DailyBrief,
  ObjectiveEditor, AppShell
- `app/globals.css` — trust badge + evidence-profile styles
- Deleted: `lib/frontend/mockData.ts`
