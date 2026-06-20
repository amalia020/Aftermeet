import { describe, expect, it, vi } from "vitest";
import { DEMO_USER_ID, demoConversationText, demoObjective } from "@/lib/demo/fixtures";
import { json, sseEvents } from "./helpers";
import { GET as getObjective, POST as postObjective } from "@/app/api/objectives/route";
import { POST as postTextCapture } from "@/app/api/capture/text/route";
import { POST as postVoiceCapture } from "@/app/api/capture/voice/route";
import { POST as postCardCapture } from "@/app/api/capture/card/route";
import { POST as postProcess } from "@/app/api/intelligence/process/route";
import { POST as postCalaEnrich } from "@/app/api/enrich/cala/route";
import { POST as postWebFallback } from "@/app/api/enrich/web/route";
import { POST as postCaptureEnrichWorkflow } from "@/app/api/workflows/capture-enrich/route";
import { POST as postCaptureWebFallbackWorkflow } from "@/app/api/workflows/capture-web-fallback/route";
import type {
  ActiveObjectiveResponse,
  CalaEnrichmentResponse,
  CaptureAcceptedResponse,
  CardCaptureAcceptedResponse,
  ErrorResponse,
  WebFallbackResponse,
  VoiceCaptureAcceptedResponse,
  WorkflowCaptureEnrichResponse,
  WorkflowCaptureWebFallbackResponse
} from "@/lib/types";

describe("objective and capture routes", () => {
  it("saves and retrieves the active objective", async () => {
    const saved = await postObjective(
      new Request("http://test/api/objectives", {
        method: "POST",
        body: JSON.stringify({
          ...demoObjective,
          id: undefined,
          primaryGoal: "find_partners",
          activeGoals: ["find_partners"]
        })
      })
    );
    expect(saved.status).toBe(201);

    const response = await getObjective(
      new Request(`http://test/api/objectives?userId=${DEMO_USER_ID}`)
    );
    const body = await json<ActiveObjectiveResponse>(response);
    expect(body.objective?.primaryGoal).toBe("find_partners");
  });

  it("accepts text capture and rejects empty or objective-less capture", async () => {
    const accepted = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, rawText: demoConversationText })
      })
    );
    expect(accepted.status).toBe(202);
    const acceptedBody = await json<CaptureAcceptedResponse>(accepted);
    expect(acceptedBody.conversationId).toMatch(/^conv_/);

    const empty = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, rawText: "" })
      })
    );
    expect(empty.status).toBe(400);

    const missingObjective = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: "user_without_objective", rawText: "Met Sam from Pine." })
      })
    );
    expect(missingObjective.status).toBe(422);
  });

  it("uses fixture transcription for voice capture without an OpenAI key", async () => {
    const form = new FormData();
    form.set("userId", DEMO_USER_ID);
    form.set("audioFile", new File([new Uint8Array([1, 2, 3])], "note.webm", { type: "audio/webm" }));

    const response = await postVoiceCapture(
      new Request("http://test/api/capture/voice", {
        method: "POST",
        body: form
      })
    );
    const body = await json<VoiceCaptureAcceptedResponse>(response);
    expect(response.status).toBe(202);
    expect(body.transcriptStatus).toBe("completed");
  });

  it("accepts card manual fallback and rejects image-only card input", async () => {
    const manual = await postCardCapture(
      new Request("http://test/api/capture/card", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          manualTextFallback: "Maya from Recursive, interested in AfterMeet."
        })
      })
    );
    const manualBody = await json<CardCaptureAcceptedResponse>(manual);
    expect(manual.status).toBe(202);
    expect(manualBody.cardStatus).toBe("manual_fallback");

    const imageOnly = await postCardCapture(
      new Request("http://test/api/capture/card", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, imageFile: { name: "card.png" } })
      })
    );
    const error = await json<ErrorResponse>(imageOnly);
    expect(imageOnly.status).toBe(422);
    expect(error.error).toBe("CARD_FALLBACK_REQUIRED");
  });
});

describe("process and enrichment routes", () => {
  it("streams process events and final handoff payload", async () => {
    const capture = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, rawText: demoConversationText })
      })
    );
    const captureBody = await json<CaptureAcceptedResponse>(capture);

    const response = await postProcess(
      new Request("http://test/api/intelligence/process", {
        method: "POST",
        body: JSON.stringify({
          requestId: captureBody.requestId,
          userId: DEMO_USER_ID,
          conversationId: captureBody.conversationId,
          captureType: "text"
        })
      })
    );
    const events = sseEvents(await response.text());
    const stages = events.map((event) => event.stage);

    expect(stages).toContain("capturing");
    expect(stages).toContain("extracting");
    expect(stages).toContain("persisting_atoms");
    expect(stages).toContain("resolving_entity");
    expect(stages).toContain("retrieving_context");
    expect(stages.at(-1)).toBe("handoff_ready");
    expect(events.at(-1).payload.extractionHandoff.contactCandidate.company).toBe("Recursive");
    expect(events.at(-1).payload.evidenceBundle.evidenceFacts.length).toBeGreaterThan(0);
  });

  it("rejects web fallback before Cala has been attempted", async () => {
    const capture = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, rawText: demoConversationText })
      })
    );
    const captureBody = await json<CaptureAcceptedResponse>(capture);

    const response = await postWebFallback(
      new Request("http://test/api/enrich/web", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          conversationId: captureBody.conversationId,
          query: "Recursive professional context",
          calaAttempted: false
        })
      })
    );
    const body = await json<ErrorResponse>(response);
    expect(response.status).toBe(422);
    expect(body.error).toBe("FALLBACK_ORDER_VIOLATION");
  });

  it("supports Cala knowledge query mode with x-api-key style auth configuration", async () => {
    process.env.CALA_API_KEY = "test-key";
    process.env.CALA_API_URL = "https://api.cala.ai/v1/knowledge/query";
    process.env.CALA_API_BASE_URL = "https://api.cala.ai/v1/knowledge/query";
    process.env.CALA_API_AUTH_HEADER = "x-api-key";
    process.env.CALA_API_AUTH_SCHEME = "";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              full_name: "Thomas Marshall Nicholson",
              role: "Chief Executive Officer",
              company: "Cala Group Limited"
            }
          ]
        })
      )
    );

    const capture = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: "I met Tom Nicholson from Cala at the event.",
          eventContext: "MEGATHON"
        })
      })
    );
    const captureBody = await json<CaptureAcceptedResponse>(capture);

    const response = await postCalaEnrich(
      new Request("http://test/api/enrich/cala", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          conversationId: captureBody.conversationId,
          name: "Tom Nicholson",
          company: "Cala",
          role: "CEO",
          query: "Tom Nicholson Cala"
        })
      })
    );
    const body = await json<CalaEnrichmentResponse>(response);

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.selectedContext?.canonicalName).toContain("Cala");

    vi.unstubAllGlobals();
    delete process.env.CALA_API_URL;
    delete process.env.CALA_API_BASE_URL;
    delete process.env.CALA_API_AUTH_HEADER;
    delete process.env.CALA_API_AUTH_SCHEME;
  });

  it("can accept uncited web claims when explicitly enabled", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Public profile found",
                      available: true,
                      claims: [
                        { text: "Tom Nicholson is the CEO of Cala." },
                        {
                          text: "Cala serves professional networking teams.",
                          sourceUrl: "https://example.com/cala"
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      )
    );

    const capture = await postTextCapture(
      new Request("http://test/api/capture/text", {
        method: "POST",
        body: JSON.stringify({ userId: DEMO_USER_ID, rawText: demoConversationText })
      })
    );
    const captureBody = await json<CaptureAcceptedResponse>(capture);

    const response = await postWebFallback(
      new Request("http://test/api/enrich/web", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          conversationId: captureBody.conversationId,
          name: "Tom Nicholson",
          company: "Cala",
          role: "CEO",
          query: "Tom Nicholson Cala professional context",
          calaAttempted: true,
          allowUncitedClaims: true
        })
      })
    );

    const body = await json<WebFallbackResponse>(response);
    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.claims).toHaveLength(2);
    expect(body.warnings.join(" ")).toContain("uncited claims were accepted temporarily");
    vi.unstubAllGlobals();
  });

  it("runs objective, capture, and Cala enrichment in one workflow request", async () => {
    const response = await postCaptureEnrichWorkflow(
      new Request("http://test/api/workflows/capture-enrich", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText:
            "I met Tom Nicholson from Cala. We discussed how AfterMeet can support event workflows.",
          eventContext: "MEGATHON",
          name: "Tom Nicholson",
          company: "Cala",
          role: "Operator",
          query: "Tom Nicholson Cala professional context"
        })
      })
    );

    const body = await json<WorkflowCaptureEnrichResponse>(response);
    expect(response.status).toBe(200);
    expect(body.objective.objectiveId).toBeTruthy();
    expect(body.capture.conversationId).toMatch(/^conv_/);
    expect(body.cala.available).toBe(false);
    expect(body.webFallback).toBeDefined();
    expect(body.webFallback?.available).toBe(false);
  });

  it("allows disabling automatic web fallback in workflow mode", async () => {
    const response = await postCaptureEnrichWorkflow(
      new Request("http://test/api/workflows/capture-enrich", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: "I met Tom Nicholson from Cala and discussed follow-up.",
          eventContext: "MEGATHON",
          name: "Tom Nicholson",
          company: "Cala",
          role: "Operator",
          query: "Tom Nicholson Cala professional context",
          includeWebFallback: false
        })
      })
    );

    const body = await json<WorkflowCaptureEnrichResponse>(response);
    expect(response.status).toBe(200);
    expect(body.cala.available).toBe(false);
    expect(body.webFallback).toBeUndefined();
  });

  it("can create an objective automatically for a new user in workflow mode", async () => {
    const response = await postCaptureEnrichWorkflow(
      new Request("http://test/api/workflows/capture-enrich", {
        method: "POST",
        body: JSON.stringify({
          userId: "user_workflow_new",
          rawText: "I met Tom Nicholson from Cala and want to follow up.",
          eventContext: "MEGATHON",
          name: "Tom Nicholson",
          company: "Cala",
          role: "Operator",
          query: "Tom Nicholson Cala professional context",
          objectiveSeed: {
            role: "founder",
            primaryGoal: "find_users",
            activeGoals: ["find_users"]
          }
        })
      })
    );

    const body = await json<WorkflowCaptureEnrichResponse>(response);
    expect(response.status).toBe(200);
    expect(body.objective.created).toBe(true);
    expect(body.capture.conversationId).toMatch(/^conv_/);
  });

  it("runs objective, capture, and web fallback in one workflow request", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Public profile found",
                      available: true,
                      claims: [
                        {
                          text: "Tom Nicholson is associated with Cala.",
                          sourceUrl: "https://example.com/cala"
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      )
    );

    const response = await postCaptureWebFallbackWorkflow(
      new Request("http://test/api/workflows/capture-web-fallback", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: "I met Tom Nicholson from Cala at the event.",
          eventContext: "MEGATHON",
          name: "Tom Nicholson",
          company: "Cala",
          role: "CEO",
          query: "Tom Nicholson Cala professional context",
          allowUncitedClaims: false
        })
      })
    );

    const body = await json<WorkflowCaptureWebFallbackResponse>(response);
    expect(response.status).toBe(200);
    expect(body.capture.conversationId).toMatch(/^conv_/);
    expect(body.webFallback.available).toBe(true);
    expect(body.webFallback.claims.length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
