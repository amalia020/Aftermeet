import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { POST as postFullFlowWorkflow } from "@/app/api/workflows/full-flow/route";
import {
  DELETE as deleteContact,
  PATCH as confirmContact,
} from "@/app/api/contacts/[id]/route";
import { DELETE as deleteEvidence } from "@/app/api/evidence/[id]/route";
import { GET as getOpenApi } from "@/app/api/openapi/route";
import type {
  ActiveObjectiveResponse,
  CalaEnrichmentResponse,
  CaptureAcceptedResponse,
  CardCaptureAcceptedResponse,
  ContactConfirmationResponse,
  ErrorResponse,
  WebFallbackResponse,
  VoiceCaptureAcceptedResponse,
  WorkflowCaptureEnrichResponse,
  WorkflowFullFlowResponse,
  WorkflowCaptureWebFallbackResponse
} from "@/lib/types";

beforeEach(async () => {
  await postObjective(
    new Request("http://test/api/objectives", {
      method: "POST",
      body: JSON.stringify(demoObjective)
    })
  );
});

const ROUTE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;
const DOCS_INFRASTRUCTURE_PATHS = new Set([
  "/api/docs",
  "/api/openapi",
  "/api/openapi.json",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return routeFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

function implementedApiOperations() {
  return routeFiles("app/api")
    .map((file) => {
      const path = `/${relative("app", file).split(sep).slice(0, -1).join("/")}`;
      const source = readFileSync(file, "utf8");
      const methods = ROUTE_METHODS
        .filter((method) =>
          new RegExp(`export\\s+(?:(?:async\\s+)?function|const)\\s+${method}\\b`).test(source),
        )
        .map((method) => method.toLowerCase());
      return { path, methods };
    })
    .filter((route) => !DOCS_INFRASTRUCTURE_PATHS.has(route.path));
}

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
    expect(body.transcript).toBeTruthy();
  });

  it("runs full flow from a captured voice conversation", async () => {
    const form = new FormData();
    form.set("userId", DEMO_USER_ID);
    form.set("audioFile", new File([new Uint8Array([1, 2, 3])], "note.webm", { type: "audio/webm" }));

    const captureResponse = await postVoiceCapture(
      new Request("http://test/api/capture/voice", {
        method: "POST",
        body: form
      })
    );
    const capture = await json<VoiceCaptureAcceptedResponse>(captureResponse);

    const response = await postFullFlowWorkflow(
      new Request("http://test/api/workflows/full-flow", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          conversationId: capture.conversationId,
          requestId: capture.requestId,
          captureType: "voice"
        })
      })
    );
    const body = await json<WorkflowFullFlowResponse>(response);

    expect(response.status).toBe(200);
    expect(body.extractionHandoff.conversation.captureType).toBe("voice");
    expect(body.extractionHandoff.sourceRecord.sourceType).toBe("user_voice_note");
    expect(body.recommendationPackage.recommendation.recommendedAction).toBeTruthy();
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

    const imageForm = new FormData();
    imageForm.set("userId", DEMO_USER_ID);
    imageForm.set("imageFile", new File(["not-a-real-image"], "card.png", { type: "image/png" }));
    const imageOnly = await postCardCapture(
      new Request("http://test/api/capture/card", { method: "POST", body: imageForm })
    );
    const error = await json<ErrorResponse>(imageOnly);
    expect(imageOnly.status).toBe(422);
    expect(error.error).toBe("CARD_FALLBACK_REQUIRED");
  });

  it("recognizes a card image and returns structured contact fields", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          modelVersion: "gemini-test",
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      rawText: "Maya Linden\nFounder, Recursive\nmaya@recursive.example",
                      name: "Maya Linden",
                      role: "Founder",
                      company: "Recursive",
                      email: "maya@recursive.example"
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    try {
      const form = new FormData();
      form.set("userId", DEMO_USER_ID);
      form.set("imageFile", new File(["image-bytes"], "card.jpg", { type: "image/jpeg" }));
      const response = await postCardCapture(
        new Request("http://test/api/capture/card", { method: "POST", body: form })
      );
      const body = await json<CardCaptureAcceptedResponse>(response);

      expect(response.status).toBe(202);
      expect(body.cardStatus).toBe("captured");
      expect(body.recognitionProvider).toBe("gemini");
      expect(body.contactCandidate).toMatchObject({
        name: "Maya Linden",
        company: "Recursive",
        email: "maya@recursive.example"
      });
      expect(body.cardText).toContain("Maya Linden");
    } finally {
      fetchMock.mockRestore();
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
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
          calaMatchConfidence: 0.4,
          allowUncitedClaims: true
        })
      })
    );

    const body = await json<WebFallbackResponse>(response);
    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.claims).toHaveLength(2);
    expect(body.warnings.join(" ")).toContain("uncited claims were accepted temporarily");
    expect(body.warnings.join(" ")).toContain("may be inaccurate");
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

  it("runs the full non-streaming workflow in one Swagger-friendly request", async () => {
    const response = await postFullFlowWorkflow(
      new Request("http://test/api/workflows/full-flow", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: demoConversationText,
          eventContext: "MEGATHON",
          name: "Maya",
          company: "Recursive",
          role: "Founder",
          query: "Recursive professional context",
          ensureObjective: true
        })
      })
    );

    const body = await json<WorkflowFullFlowResponse>(response);
    expect(response.status).toBe(200);
    expect(body.capture.conversationId).toMatch(/^conv_/);
    expect(body.extractionHandoff.contactCandidate.company).toBe("Recursive");
    expect(body.evidenceBundle.evidenceFacts.length).toBeGreaterThan(0);
    expect(body.recommendationPackage.recommendation.recommendedAction).toBeTruthy();
    expect(body.events.at(-1)?.stage).toBe("handoff_ready");
  });

  it("lists every implemented API operation in the OpenAPI document", async () => {
    const response = await getOpenApi(new Request("http://test/api/openapi"));
    const body = await json<{
      paths: Record<string, Record<string, unknown>>;
    }>(response);

    const missing = implementedApiOperations().flatMap((route) => {
      const documentedMethods = Object.keys(body.paths[route.path] ?? {});
      return route.methods
        .filter((method) => !documentedMethods.includes(method))
        .map((method) => `${method.toUpperCase()} ${route.path}`);
    });

    expect(missing).toEqual([]);
  });
});

describe("contact trust controls", () => {
  it("persists confirmed identity and regenerates the recommendation", async () => {
    const flow = await postFullFlowWorkflow(
      new Request("http://test/api/workflows/full-flow", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: demoConversationText,
        }),
      }),
    );
    const flowBody = await json<WorkflowFullFlowResponse>(flow);
    const contactId = flowBody.evidenceBundle.contactId!;

    const response = await confirmContact(
      new Request(`http://test/api/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          name: "Jazzley Louisville",
          role: "Founder",
          company: "EkkoTech",
          website: "https://ekkotech.nl",
        }),
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    const body = await json<ContactConfirmationResponse>(response);

    expect(response.status).toBe(200);
    expect(body.contact.entityMatchConfidence).toBe(1);
    expect(body.recommendationPackage?.recommendation.recommendedAction).not.toBe(
      "CONFIRM_DETAILS",
    );
  });

  it("deletes evidence and then cascades contact deletion", async () => {
    const flow = await postFullFlowWorkflow(
      new Request("http://test/api/workflows/full-flow", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          rawText: demoConversationText,
        }),
      }),
    );
    const flowBody = await json<WorkflowFullFlowResponse>(flow);
    const contactId = flowBody.evidenceBundle.contactId!;
    const factId = flowBody.evidenceBundle.evidenceFacts[0]?.id;
    expect(factId).toBeTruthy();

    const factResponse = await deleteEvidence(
      new Request(`http://test/api/evidence/${factId}?userId=${DEMO_USER_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: factId! }) },
    );
    expect(factResponse.status).toBe(200);

    const contactResponse = await deleteContact(
      new Request(`http://test/api/contacts/${contactId}?userId=${DEMO_USER_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(contactResponse.status).toBe(200);

    const repeated = await deleteContact(
      new Request(`http://test/api/contacts/${contactId}?userId=${DEMO_USER_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(repeated.status).toBe(404);
  });
});
