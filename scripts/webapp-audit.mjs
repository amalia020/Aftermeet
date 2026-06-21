import { chromium } from "playwright";

const baseURL = globalThis.process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

try {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  await context.grantPermissions(["camera"], { origin: baseURL });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    const requestUrl = new globalThis.URL(request.url());
    const localFrameworkRequest =
      requestUrl.origin === new globalThis.URL(baseURL).origin &&
      (requestUrl.searchParams.has("_rsc") ||
        (request.resourceType() === "stylesheet" && requestUrl.pathname.startsWith("/_next/")));
    const expectedNavigationAbort =
      errorText === "net::ERR_ABORTED" &&
      (request.isNavigationRequest() || request.resourceType() === "script" || localFrameworkRequest);
    if (!expectedNavigationAbort) {
      failedRequests.push(`${request.method()} ${request.url()} ${errorText}`);
    }
  });

  const reset = await context.request.post(`${baseURL}/api/demo/reset`);
  if (!reset.ok()) throw new Error(`Demo reset failed: ${reset.status()}`);
  const objective = await context.request.post(`${baseURL}/api/objectives`, {
    data: {
      userId: "user_demo",
      role: "founder",
      primaryGoal: "find_users",
      activeGoals: ["find_users", "find_design_partners"],
      eventContext: "MEGATHON",
      companyName: "AfterMeet",
      productDescription: "Relationship intelligence for networking events",
      targetCustomer: "Event-heavy founders and operators",
      attentionBudgetToday: 5,
      preferredTone: "warm",
      constraints: ["Do not auto-send messages"],
    },
  });
  if (!objective.ok()) throw new Error(`Objective seed failed: ${objective.status()}`);

  const routeChecks = [
    { path: "/", ready: (targetPage) => targetPage.getByRole("heading").first() },
    {
      path: "/objective",
      ready: (targetPage) => targetPage.getByRole("heading", { name: "Relationship setup" }),
    },
    {
      path: "/capture",
      ready: (targetPage) => targetPage.getByRole("heading", { name: "Add relationship signal" }),
    },
    { path: "/board", ready: (targetPage) => targetPage.getByRole("heading").first() },
    { path: "/terminal", ready: (targetPage) => targetPage.getByRole("heading").first() },
    { path: "/traction", ready: (targetPage) => targetPage.getByRole("heading").first() },
    { path: "/docs", ready: (targetPage) => targetPage.locator("#swagger-ui") },
    { path: "/swagger", ready: (targetPage) => targetPage.locator("#swagger-ui") },
  ];

  for (const check of routeChecks) {
    try {
      const response = await page.goto(check.path, { waitUntil: "networkidle", timeout: 30_000 });
      await check.ready(page).waitFor({ state: "visible", timeout: 15_000 });
      record(`route ${check.path}`, response?.ok() ? "pass" : "fail", `status=${response?.status()}`);
    } catch (error) {
      record(`route ${check.path}`, "fail", error.message);
      await page.screenshot({ path: `/private/tmp/aftermeet-route-failure-${check.path.replaceAll("/", "-") || "home"}.png`, fullPage: true });
    }
  }

  await page.goto("/capture", { waitUntil: "networkidle" });
  try {
    await page.getByRole("button", { name: "Scan card" }).click();
    const cameraDialog = page.getByRole("dialog", { name: "Business card camera" });
    await cameraDialog.waitFor({ state: "visible", timeout: 10_000 });
    await page.locator(".camera-viewport video").evaluate(async (video) => {
      if (video.readyState < globalThis.HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
      }
    });
    record("camera opens", "pass");
    await page.getByRole("button", { name: "Capture card" }).click();
    await cameraDialog.waitFor({ state: "hidden" });
    await page.getByText(/business-card-\d+\.jpg ready for recognition/).waitFor({ state: "visible" });
    record("camera shutter creates OCR image", "pass");
    await page.reload({ waitUntil: "networkidle" });
  } catch (error) {
    record("camera shutter creates OCR image", "fail", error.message);
    await page.screenshot({ path: "/private/tmp/aftermeet-camera-failure.png", fullPage: true });
  }

  try {
    await page.getByLabel("Relationship note").fill(
      "Met Maya from Recursive after the AI panel. She is the founder and wants to explore AfterMeet for event follow-up workflows.",
    );
    await page.getByRole("button", { name: /Analyze relationship/i }).click();
    await page.locator(".stage-pill").first().waitFor({ state: "visible", timeout: 15_000 });
    record("live processing stages", "pass", await page.locator(".stage-pill").first().innerText());
    await page.getByText("Intelligence package").waitFor({ state: "visible", timeout: 90_000 });
    const stages = await page.locator(".stage-pill").allTextContents();
    record("capture completes", stages.some((stage) => stage.includes("handoff ready")) ? "pass" : "fail", stages.join(", "));
  } catch (error) {
    record("capture completes", "fail", error.message);
    await page.screenshot({ path: "/private/tmp/aftermeet-capture-failure.png", fullPage: true });
  }

  let contactHref = null;
  try {
    await page.goto("/board", { waitUntil: "networkidle" });
    const contactLink = page.locator('a[href^="/contacts/"]').first();
    contactHref = await contactLink.getAttribute("href");
    if (!contactHref) throw new Error("No contact link appeared after capture.");
    await page.goto(contactHref, { waitUntil: "networkidle" });
    await page.getByText("Evidence trace").waitFor({ state: "visible" });
    const facts = await page.locator(".source-fact").count();
    const sourceLinks = await page.locator(".source-fact a").count();
    record("source register", facts > 0 ? "pass" : "fail", `facts=${facts} sourceLinks=${sourceLinks}`);

    const reviewButton = page.getByRole("button", { name: "Review details" });
    if (await reviewButton.count()) {
      await reviewButton.click();
      await page.getByRole("region", { name: "Confirm contact details" }).waitFor({ state: "visible" });
      record("confirmation form", "pass");
    } else {
      record("confirmation form", "skipped", "Captured identity did not require confirmation.");
    }

    const removeFact = page.getByRole("button", { name: "Remove evidence fact" }).first();
    if (await removeFact.count()) {
      const before = await page.locator(".source-fact").count();
      await removeFact.click();
      await page.waitForFunction((count) => globalThis.document.querySelectorAll(".source-fact").length < count, before);
      record("evidence deletion", "pass");
    } else {
      record("evidence deletion", "skipped", "No removable evidence fact.");
    }

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/capture", { timeout: 15_000 });
    record("contact deletion", "pass");
  } catch (error) {
    record("contact controls", "fail", error.message);
    await page.screenshot({ path: "/private/tmp/aftermeet-contact-failure.png", fullPage: true });
  }

  try {
    await page.goto("/capture", { waitUntil: "networkidle" });
    await page.getByLabel("Relationship note").fill(
      "Met Alex briefly after the event. We discussed product feedback and agreed to reconnect.",
    );
    await page.getByRole("button", { name: /Analyze relationship/i }).click();
    await page.getByText("Intelligence package").waitFor({ state: "visible", timeout: 90_000 });
    await page.goto("/board", { waitUntil: "networkidle" });
    const ambiguousContactHref = await page.locator('a[href^="/contacts/"]').first().getAttribute("href");
    if (!ambiguousContactHref) throw new Error("Ambiguous capture produced no contact link.");
    await page.goto(ambiguousContactHref, { waitUntil: "networkidle" });
    const reviewButton = page.getByRole("button", { name: "Review details" });
    if (!(await reviewButton.count())) {
      record("confirmation form", "fail", "Low-information identity did not expose Review details.");
    } else {
      await reviewButton.click();
      const panel = page.getByRole("region", { name: "Confirm contact details" });
      await panel.waitFor({ state: "visible" });
      await panel.getByLabel("name", { exact: true }).fill("Alex Johnson");
      await panel.getByLabel("company", { exact: true }).fill("Example Labs");
      await panel.getByRole("button", { name: "Save confirmed details" }).click();
      await page.getByText("Details confirmed").waitFor({ state: "visible", timeout: 30_000 });
      record("confirmation save", "pass");
    }
  } catch (error) {
    record("confirmation save", "fail", error.message);
    await page.screenshot({ path: "/private/tmp/aftermeet-confirmation-failure.png", fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/capture", "/board", "/objective"]) {
    try {
      await page.goto(path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth);
      record(`mobile ${path}`, overflow <= 1 ? "pass" : "fail", `horizontalOverflow=${overflow}px`);
    } catch (error) {
      record(`mobile ${path}`, "fail", error.message);
    }
  }
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
  await page.screenshot({ path: "/private/tmp/aftermeet-mobile-capture.png", fullPage: true });

  record("console errors", consoleErrors.length === 0 ? "pass" : "fail", consoleErrors.join(" | "));
  record("page errors", pageErrors.length === 0 ? "pass" : "fail", pageErrors.join(" | "));
  record("failed requests", failedRequests.length === 0 ? "pass" : "fail", failedRequests.join(" | "));

  globalThis.console.log(JSON.stringify({ results, consoleErrors, pageErrors, failedRequests, contactHref }, null, 2));
  if (results.some((result) => result.status === "fail")) {
    globalThis.process.exitCode = 1;
  }
  await context.close();
} finally {
  await browser.close();
}
