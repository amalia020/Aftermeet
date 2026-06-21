# Webapp Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every issue found by the 2026-06-21 Playwright audit: vulnerable test tooling, unbounded Gemini fallback latency, mobile content hidden by navigation, ambiguous evidence provenance, and incomplete camera/OCR browser coverage.

**Architecture:** Keep product behavior and existing provider order intact. Apply bounded reliability controls at the Gemini provider boundary, represent evidence provenance explicitly in the person-view contract, fix layout spacing in CSS, and make the Playwright audit deterministic enough to run repeatedly without false positives. Hardware camera validation remains a small manual smoke test because CI uses Chromium's fake media device.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Vitest 4, Playwright 1.61, Chromium, CSS, Gemini REST API.

## Global Constraints

- Preserve Cala-first enrichment and Gemini fallback ordering.
- Gemini fallback has one total wall-clock budget of `15_000` milliseconds across all model candidates.
- Timeout fallback returns typed unavailable context; it must not fail the capture pipeline.
- User-captured evidence must not be described as externally verified.
- Uncited Gemini context remains unverified and `safeForDraft=false`.
- The bottom navigation must not cover focusable form controls at `390x844` or wider viewports.
- Browser tests use role/label selectors and Playwright auto-waiting; no hard-coded sleeps.
- Physical camera testing never sends a real business card containing personal data.
- Do not run `npm audit fix --force`; dependency upgrades must be explicit and reviewed.

---

## File Structure

### Modified Files

- `package.json` — upgrade Vitest and expose the browser-audit command.
- `package-lock.json` — lock the reviewed Vitest/Vite dependency graph.
- `lib/providers/gemini.ts` — enforce one abortable timeout around grounded web fallback.
- `lib/providers/__tests__/gemini.test.ts` — verify timeout behavior and typed fallback.
- `app/globals.css` — reserve mobile scroll space above the fixed bottom navigation.
- `lib/frontend/viewModels.ts` — expose explicit evidence provenance categories and labels.
- `components/PersonIntelligence.tsx` — render first-party, confirmed, cited, and AI-suggested evidence distinctly.
- `tests/relationshipDeltaIntegration.test.ts` — verify evidence provenance mapping.
- `scripts/webapp-audit.mjs` — remove navigation false positives, test camera shutter capture, and assert non-occlusion.

### Created Files

- `docs/testing/camera-smoke-test.md` — repeatable physical-device camera/OCR checklist.

---

### Task 1: Upgrade Vulnerable Test Tooling

**Files:**
- Modify: `package.json:19-34`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: existing `npm test` script and Vitest test files.
- Produces: Vitest `^4.1.9`, no critical/high npm advisory from Vitest or its Vite graph, and unchanged test commands.

- [ ] **Step 1: Capture the current failing security baseline**

Run:

```bash
npm audit --audit-level=high
```

Expected: FAIL and report `GHSA-5xrq-8626-4rwp` against Vitest `<3.2.6`, plus the vulnerable Vite dependency graph.

- [ ] **Step 2: Run the current test baseline before the major upgrade**

Run:

```bash
npm test
```

Expected: PASS with 17 test files and 107 tests.

- [ ] **Step 3: Upgrade Vitest explicitly**

Run:

```bash
npm install --save-dev vitest@^4.1.9
```

Expected: `package.json` contains:

```json
{
  "devDependencies": {
    "vitest": "^4.1.9"
  }
}
```

Do not change React, Next.js, TypeScript, Playwright, or ESLint in this task.

- [ ] **Step 4: Verify behavior and the dependency graph**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```

Expected: tests, typecheck, and lint PASS. Audit reports no critical/high advisory in `vitest`, `vite`, `vite-node`, `@vitest/mocker`, or `esbuild`.

- [ ] **Step 5: Commit the isolated dependency upgrade**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade vulnerable vitest toolchain"
```

---

### Task 2: Bound Gemini Grounded-Search Latency

**Files:**
- Modify: `lib/providers/gemini.ts:198-312`
- Test: `lib/providers/__tests__/gemini.test.ts`

**Interfaces:**
- Consumes: `geminiWebContext({ name?, company?, role?, query, now? })`.
- Produces: `geminiWebContext({ ..., timeoutMs? })`, with one `AbortSignal` shared across model attempts and a typed unavailable `WebContextResult` on timeout.

- [ ] **Step 1: Write a failing timeout test**

Add this import and test to `lib/providers/__tests__/gemini.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  geminiWebContext,
  parseGroundedGeminiCandidate,
} from "@/lib/providers/gemini";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

it("aborts grounded search after one total timeout budget", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }),
  );

  const startedAt = Date.now();
  const result = await geminiWebContext({
    name: "Alex",
    query: "Alex professional context",
    timeoutMs: 10,
  });

  expect(result.available).toBe(false);
  expect(result.claims).toEqual([]);
  expect(result.warnings?.join(" ")).toContain("timed out after 10ms");
  expect(Date.now() - startedAt).toBeLessThan(500);
  expect(fetch).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the timeout test to verify it fails**

Run:

```bash
npm test -- lib/providers/__tests__/gemini.test.ts
```

Expected: FAIL because `timeoutMs` is not part of the input contract and `fetch` receives no signal.

- [ ] **Step 3: Add one total abort budget to the provider**

Update the function input and wrap all model attempts with one controller:

```ts
export async function geminiWebContext(input: {
  name?: string;
  company?: string;
  role?: string;
  query: string;
  now?: Date;
  timeoutMs?: number;
}): Promise<WebContextResult> {
  // Keep the existing environment lookup, missing-key return, prompt, and
  // modelCandidates construction above this block.
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (const model of modelCandidates) {
      const useGoogleSearchTool = /2\.5|latest/i.test(model);
      const tools = useGoogleSearchTool
        ? [{ google_search: {} }]
        : [{ google_search_retrieval: {} }];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools,
            generationConfig: { temperature: 0 },
          }),
          signal: controller.signal,
        },
      );

      // Preserve the existing non-OK handling, grounded-response parser,
      // warning accumulation, successful return, and exhausted-model return.
    }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      summary: "",
      claims: [],
      retrievedAt: new Date().toISOString(),
      available: false,
      warnings: [
        timedOut
          ? `Gemini web fallback timed out after ${timeoutMs}ms; continuing with captured evidence.`
          : error instanceof Error
            ? `Gemini web fallback request failed: ${error.message}`
            : "Gemini web fallback request failed before a response was received.",
      ],
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

Create the controller only after the missing-key early return. Keep the existing prompt, `modelCandidates`, grounding parser, warning accumulation, and exhausted-candidates return.

- [ ] **Step 4: Verify provider and enrichment fallback behavior**

Run:

```bash
npm test -- lib/providers/__tests__/gemini.test.ts tests/enrichment.test.ts
npm run typecheck
```

Expected: PASS. The timeout test completes in under 500ms, and enrichment still produces conversation-only evidence when Gemini is unavailable.

- [ ] **Step 5: Commit the provider reliability change**

```bash
git add lib/providers/gemini.ts lib/providers/__tests__/gemini.test.ts
git commit -m "fix: bound Gemini fallback latency"
```

---

### Task 3: Keep Mobile Form Controls Above Fixed Navigation

**Files:**
- Modify: `app/globals.css:138-140,445-456,1458-1477`
- Test: `scripts/webapp-audit.mjs`

**Interfaces:**
- Consumes: `.screen`, `.bottom-nav`, and the `/objective` form.
- Produces: a `--bottom-nav-clearance` layout token and a browser assertion that the save control can scroll fully above the fixed navigation.

- [ ] **Step 1: Add a failing non-occlusion assertion to the audit**

After navigating to `/objective` at `390x844`, add:

```js
const saveButton = page.getByRole("button", { name: "Save setup" });
await saveButton.scrollIntoViewIfNeeded();
const saveBox = await saveButton.boundingBox();
const navBox = await page.locator(".bottom-nav").boundingBox();
const saveIsClear = Boolean(
  saveBox && navBox && saveBox.y + saveBox.height <= navBox.y - 8,
);
record(
  "mobile objective controls clear navigation",
  saveIsClear ? "pass" : "fail",
  `saveBottom=${saveBox ? saveBox.y + saveBox.height : "missing"} navTop=${navBox?.y ?? "missing"}`,
);
```

- [ ] **Step 2: Run the audit and verify the new check fails**

Run with the app already started:

```bash
node scripts/webapp-audit.mjs
```

Expected: `mobile objective controls clear navigation` reports `fail` because the fixed nav occupies the save button's viewport area.

- [ ] **Step 3: Add stable navigation clearance**

Add the token and use it in the base mobile layout:

```css
:root {
  --bottom-nav-clearance: calc(110px + env(safe-area-inset-bottom));
}

.screen {
  padding: clamp(28px, 6vw, 46px) clamp(20px, 5vw, 42px);
  padding-bottom: var(--bottom-nav-clearance);
  scroll-padding-bottom: var(--bottom-nav-clearance);
}

@media (min-width: 760px) {
  :root {
    --bottom-nav-clearance: 120px;
  }
}
```

Preserve the current `.bottom-nav` dimensions and desktop centering. Remove the duplicate desktop `.screen { padding-bottom: 120px; }` after the token replaces it.

- [ ] **Step 4: Verify mobile and desktop layout**

Run:

```bash
node scripts/webapp-audit.mjs
npm run build
```

Expected: all three mobile routes report `horizontalOverflow=0px`; the new objective-control check passes; production build passes.

- [ ] **Step 5: Commit the layout correction**

```bash
git add app/globals.css scripts/webapp-audit.mjs
git commit -m "fix: keep mobile forms clear of bottom navigation"
```

---

### Task 4: Clarify Evidence Provenance Without Requiring URLs

**Files:**
- Modify: `lib/frontend/viewModels.ts:96-134,753-777`
- Modify: `components/PersonIntelligence.tsx:190-225`
- Modify: `app/globals.css` source-register styles
- Test: `tests/relationshipDeltaIntegration.test.ts`

**Interfaces:**
- Consumes: `EvidenceFact.sourceType`, optional `SourceRecord`, and source URL.
- Produces: `evidence.facts[].provenance` with exact values `"captured" | "confirmed" | "cited" | "ai_suggested"`, plus a user-facing `sourceLabel`.

- [ ] **Step 1: Add failing provenance mapping tests**

Export this pure helper from `lib/frontend/viewModels.ts` and test it in `tests/relationshipDeltaIntegration.test.ts`:

```ts
import { evidenceProvenance } from "@/lib/frontend/viewModels";

it("distinguishes first-party, confirmed, cited, and AI-suggested evidence", () => {
  expect(evidenceProvenance({ sourceType: "user_voice_note" })).toEqual({
    provenance: "captured",
    sourceLabel: "Captured by you",
  });
  expect(evidenceProvenance({ sourceType: "user_confirmed" })).toEqual({
    provenance: "confirmed",
    sourceLabel: "Confirmed by you",
  });
  expect(evidenceProvenance({ sourceType: "cala_verified_fact" })).toEqual({
    provenance: "cited",
    sourceLabel: "Cala-verified public source",
  });
  expect(
    evidenceProvenance({
      sourceType: "reputable_news",
      sourceUrl: "https://reuters.com/example",
    }),
  ).toEqual({
    provenance: "cited",
    sourceLabel: "Cited public source",
  });
  expect(evidenceProvenance({ sourceType: "unknown" })).toEqual({
    provenance: "ai_suggested",
    sourceLabel: "AI-suggested; verify before use",
  });
});
```

- [ ] **Step 2: Run the mapping test to verify it fails**

Run:

```bash
npm test -- tests/relationshipDeltaIntegration.test.ts
```

Expected: FAIL because `evidenceProvenance` is not exported.

- [ ] **Step 3: Implement the pure provenance mapper**

Add to `lib/frontend/viewModels.ts`:

```ts
export type EvidenceProvenance = "captured" | "confirmed" | "cited" | "ai_suggested";

export function evidenceProvenance(input: {
  sourceType: string;
  sourceUrl?: string | null;
}): { provenance: EvidenceProvenance; sourceLabel: string } {
  if (input.sourceType === "user_confirmed") {
    return { provenance: "confirmed", sourceLabel: "Confirmed by you" };
  }
  if (["user_voice_note", "business_card", "manual"].includes(input.sourceType)) {
    return { provenance: "captured", sourceLabel: "Captured by you" };
  }
  if (input.sourceType === "cala_verified_fact") {
    return { provenance: "cited", sourceLabel: "Cala-verified public source" };
  }
  if (input.sourceUrl) {
    return { provenance: "cited", sourceLabel: "Cited public source" };
  }
  return {
    provenance: "ai_suggested",
    sourceLabel: "AI-suggested; verify before use",
  };
}
```

Replace the current `verified: boolean` field in `PersonIntelligenceViewModel` with:

```ts
provenance: EvidenceProvenance;
sourceLabel: string;
```

When mapping facts, call `evidenceProvenance({ sourceType, sourceUrl })` and spread the result into the fact view model.

- [ ] **Step 4: Render provenance-specific status text**

Replace the binary Verified/Unverified span in `PersonIntelligence.tsx` with:

```tsx
<span className={`source-status source-${fact.provenance}`}>
  {fact.sourceLabel}
</span>
```

Use four restrained status colors:

```css
.source-status.source-captured { color: var(--cyan); }
.source-status.source-confirmed { color: var(--mint); }
.source-status.source-cited { color: var(--violet); }
.source-status.source-ai_suggested { color: var(--coral); }
```

Keep the external source link visible only when `sourceUrl` exists. A missing URL for captured/confirmed evidence is expected and must not appear as an error.

- [ ] **Step 5: Verify provenance UI and contracts**

Run:

```bash
npm test -- tests/relationshipDeltaIntegration.test.ts
npm run typecheck
npm run lint
```

Expected: PASS. First-party facts show `Captured by you`; user corrections show `Confirmed by you`; Cala facts show `Cala-verified public source`; web links show `Cited public source`; uncited Gemini context shows the warning label.

- [ ] **Step 6: Commit the trust-copy improvement**

```bash
git add lib/frontend/viewModels.ts components/PersonIntelligence.tsx app/globals.css tests/relationshipDeltaIntegration.test.ts
git commit -m "feat: clarify evidence provenance labels"
```

---

### Task 5: Harden Browser Audit and Complete Camera Coverage

**Files:**
- Modify: `package.json:6-15`
- Modify: `scripts/webapp-audit.mjs`
- Create: `docs/testing/camera-smoke-test.md`

**Interfaces:**
- Consumes: local server at `BASE_URL`, fake Chromium camera, capture UI, and `/api/capture/card`.
- Produces: `npm run test:webapp`, deterministic route checks, camera shutter coverage, actionable failed-request reporting, and a physical-device checklist.

- [ ] **Step 1: Add a stable browser-audit script command**

Add to `package.json`:

```json
{
  "scripts": {
    "test:webapp": "node scripts/webapp-audit.mjs"
  }
}
```

- [ ] **Step 2: Replace the heading-only route assertion**

Define route-specific readiness checks in `scripts/webapp-audit.mjs`:

```js
const routeChecks = [
  { path: "/", ready: (page) => page.getByRole("heading").first() },
  { path: "/objective", ready: (page) => page.getByRole("heading", { name: "Relationship setup" }) },
  { path: "/capture", ready: (page) => page.getByRole("heading", { name: "Add relationship signal" }) },
  { path: "/board", ready: (page) => page.getByRole("heading").first() },
  { path: "/traction", ready: (page) => page.getByRole("heading").first() },
  { path: "/docs", ready: (page) => page.getByRole("heading").first() },
  { path: "/swagger", ready: (page) => page.locator(".swagger-ui") },
];

for (const check of routeChecks) {
  const response = await page.goto(check.path, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await check.ready(page).waitFor({ state: "visible", timeout: 15_000 });
  record(`route ${check.path}`, response?.ok() ? "pass" : "fail", `status=${response?.status()}`);
}
```

Do not require headings inside Swagger UI.

- [ ] **Step 3: Filter only expected navigation aborts**

Replace unconditional failed-request collection with:

```js
page.on("requestfailed", (request) => {
  const errorText = request.failure()?.errorText ?? "failed";
  const expectedNavigationAbort =
    errorText === "net::ERR_ABORTED" &&
    (request.isNavigationRequest() || request.resourceType() === "script");
  if (!expectedNavigationAbort) {
    failedRequests.push(`${request.method()} ${request.url()} ${errorText}`);
  }
});
```

This removes route-sweep noise while preserving API, image, stylesheet, SSE, and unexpected script failures.

- [ ] **Step 4: Exercise fake-camera shutter capture**

Extend the camera test:

```js
await page.getByRole("button", { name: "Scan card" }).click();
const cameraDialog = page.getByRole("dialog", { name: "Business card camera" });
await cameraDialog.waitFor({ state: "visible" });
await page.locator(".camera-viewport video").evaluate(async (video) => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
  }
});
await page.getByRole("button", { name: "Capture card" }).click();
await cameraDialog.waitFor({ state: "hidden" });
await page.getByText(/business-card-\d+\.jpg ready for recognition/).waitFor({
  state: "visible",
});
record("camera shutter creates OCR image", "pass");
```

This validates browser frame capture without sending fake pixels to Gemini.

- [ ] **Step 5: Add the physical-device smoke test document**

Create `docs/testing/camera-smoke-test.md` with this exact content:

```markdown
# Physical Camera And OCR Smoke Test

Run on one current iPhone/Safari device and one current Android/Chrome device over HTTPS.

1. Open `/capture` and tap **Scan card**.
2. Grant camera permission and verify the rear camera is selected.
3. Confirm the preview fills the viewport and the framing guide is fully visible.
4. Photograph a synthetic card containing: `Alex Johnson`, `Founder`, `Example Labs`, `alex@example.test`, and `https://example.test`.
5. Verify the camera closes and the captured JPEG reports **ready for recognition**.
6. Add `Discussed a product pilot` as meeting context and select **Analyze relationship**.
7. Verify live stages appear before completion.
8. Verify the resulting contact fields exactly match the synthetic card and meeting context.
9. Deny camera permission, retry, and verify the UI shows a useful error plus the image-upload fallback.
10. Delete the synthetic contact and verify it disappears from the board.

Pass criteria: no clipped controls, no persistent camera indicator after close, correct OCR fields, no console errors, and successful cleanup.
```

- [ ] **Step 6: Run the complete browser and application verification**

Start the app in one terminal:

```bash
npm run dev
```

Run in another terminal:

```bash
npm run test:webapp
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: browser audit contains no `fail` results; all 107-or-more unit/integration tests pass; typecheck, lint, and build pass. Perform the physical-device checklist separately and record device/browser versions in the test report.

- [ ] **Step 7: Commit the browser-test hardening**

```bash
git add package.json scripts/webapp-audit.mjs docs/testing/camera-smoke-test.md
git commit -m "test: harden browser and camera coverage"
```

---

## Final Verification

- [ ] Run `npm audit --audit-level=high` and confirm no critical/high Vitest/Vite advisories.
- [ ] Run `npm test` and confirm all test files pass.
- [ ] Run `npm run typecheck` and confirm zero TypeScript errors.
- [ ] Run `npm run lint` and confirm zero ESLint errors.
- [ ] Run `npm run build` and confirm all Next.js routes compile.
- [ ] Run `npm run test:webapp` against a clean demo store and confirm no failed checks.
- [ ] Complete `docs/testing/camera-smoke-test.md` on iPhone/Safari and Android/Chrome.
- [ ] Confirm ambiguous-contact capture returns within 15 seconds plus local processing overhead.
- [ ] Confirm user-captured facts no longer appear as externally verified or as missing-source errors.
