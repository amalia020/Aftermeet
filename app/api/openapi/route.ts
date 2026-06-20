/**
 * OpenAPI 3.0 spec for the AfterMeet API. Served as JSON and rendered by the
 * Swagger UI at /docs. Every endpoint works with zero API keys (fixture
 * fallback), so "Try it out" exercises the full request/response contract.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "AfterMeet API",
    version: "0.1.0",
    description:
      "Goal-conditioned relationship intelligence pipeline.\n\n**Every endpoint has a fixture fallback** — you can test all of them without any API keys. Without keys the LLM/Cala/Gemini stages return demo data (labelled), while validation, status codes, scoring, and contracts behave exactly as in production.\n\nFlow: set a mission (`/api/objectives`) → capture (`/api/capture/text`) → stream the pipeline (`/api/intelligence/process`).",
  },
  servers: [{ url: "/", description: "Same origin" }],
  tags: [
    { name: "Health", description: "Liveness & provider diagnostics" },
    { name: "Mission", description: "User objective profile" },
    { name: "Capture", description: "Conversation capture (text/voice/card)" },
    { name: "Pipeline", description: "Extraction → enrichment → recommendation" },
    { name: "Enrichment", description: "Cala + web fallback" },
    { name: "Outcomes", description: "Traction tracking" },
    { name: "Demo", description: "Reset demo store" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness + demo-mode/provider availability",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/diagnostics/providers": {
      get: {
        tags: ["Health"],
        summary: "Probe each provider; reports live vs fallback per API",
        responses: { "200": { description: "Per-provider probe results" } },
      },
    },
    "/api/objectives": {
      get: {
        tags: ["Mission"],
        summary: "Get the active objective for the demo user",
        responses: { "200": { description: "{ objective }" } },
      },
      post: {
        tags: ["Mission"],
        summary: "Create/replace the active objective (required before capture)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ObjectiveInput" },
              example: {
                userId: "user_demo",
                role: "founder",
                primaryGoal: "find_users",
                secondaryGoals: ["find_design_partners"],
                activeGoals: ["find_users"],
                eventContext: "MEGATHON",
                companyName: "AfterMeet",
                attentionBudgetToday: 5,
                preferredTone: "warm",
                constraints: [],
              },
            },
          },
        },
        responses: {
          "200": { description: "Saved UserObjectiveProfile" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/capture/text": {
      post: {
        tags: ["Capture"],
        summary: "Capture a text note → creates a conversation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TextCapture" },
              example: {
                userId: "user_demo",
                rawText:
                  "Met Maya from Recursive, just closed Series A, doing the European conference circuit, wants to try AfterMeet at her next event.",
                eventContext: "MEGATHON",
              },
            },
          },
        },
        responses: {
          "200": { description: "CaptureAcceptedResponse (has streamUrl)" },
          "400": { description: "Validation error" },
          "409": { description: "No active objective — set a mission first" },
        },
      },
    },
    "/api/capture/voice": {
      post: {
        tags: ["Capture"],
        summary: "Capture a voice note (multipart). Transcribes via Whisper / fixture",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  audioFile: { type: "string", format: "binary" },
                  userId: { type: "string", example: "user_demo" },
                  eventContext: { type: "string", example: "MEGATHON" },
                },
              },
            },
          },
        },
        responses: { "202": { description: "VoiceCaptureAcceptedResponse" } },
      },
    },
    "/api/capture/card": {
      post: {
        tags: ["Capture"],
        summary: "Capture a business card (multipart: image or manualTextFallback)",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  imageFile: { type: "string", format: "binary" },
                  manualTextFallback: {
                    type: "string",
                    example: "Maya Linden — Founder, Recursive — maya@recursive.ai",
                  },
                  userId: { type: "string", example: "user_demo" },
                  eventContext: { type: "string", example: "MEGATHON" },
                },
              },
            },
          },
        },
        responses: { "202": { description: "CardCaptureAcceptedResponse" } },
      },
    },
    "/api/intelligence/process": {
      get: {
        tags: ["Pipeline"],
        summary:
          "Stream the full pipeline for a captured conversation (Server-Sent Events)",
        description:
          "Returns text/event-stream. Each `data:` line is a ProcessStageEvent. The final `handoff_ready` event payload is the RecommendationPackage. NOTE: Swagger shows the raw stream text, not a live feed.",
        parameters: [
          {
            name: "conversationId",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "conv_xxxxx",
          },
        ],
        responses: { "200": { description: "SSE stream" } },
      },
      post: {
        tags: ["Pipeline"],
        summary: "Process by conversationId or raw text (SSE stream)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  conversationId: { type: "string" },
                  rawText: { type: "string" },
                  captureType: { type: "string", enum: ["text", "voice", "card"] },
                },
              },
              example: {
                rawText:
                  "Met Maya from Recursive, closed Series A, wants to try our product.",
                captureType: "text",
              },
            },
          },
        },
        responses: { "200": { description: "SSE stream" } },
      },
    },
    "/api/intelligence/recommend": {
      post: {
        tags: ["Pipeline"],
        summary: "Get a RecommendationPackage in one JSON (non-streaming)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  conversationId: { type: "string" },
                  contactId: { type: "string" },
                },
              },
              example: { userId: "user_demo", conversationId: "conv_demo" },
            },
          },
        },
        responses: { "200": { description: "RecommendationPackage" } },
      },
    },
    "/api/draft/generate": {
      post: {
        tags: ["Pipeline"],
        summary: "Generate/regenerate a draft for a recommendation (never sends)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recommendationId"],
                properties: {
                  userId: { type: "string" },
                  recommendationId: { type: "string" },
                  tone: {
                    type: "string",
                    enum: ["direct", "warm", "formal", "casual", "concise"],
                  },
                },
              },
              example: { recommendationId: "rec_demo", tone: "warm" },
            },
          },
        },
        responses: {
          "200": { description: "DraftGenerateResponse" },
          "404": { description: "Recommendation not found" },
        },
      },
    },
    "/api/enrich/cala": {
      post: {
        tags: ["Enrichment"],
        summary: "Cala company/fund context (primary, always tried first)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["conversationId"],
                properties: {
                  userId: { type: "string" },
                  conversationId: { type: "string" },
                  name: { type: "string" },
                  company: { type: "string" },
                  query: { type: "string" },
                },
              },
              example: {
                conversationId: "conv_demo",
                name: "Maya",
                company: "Recursive",
              },
            },
          },
        },
        responses: {
          "200": { description: "CalaEnrichmentResponse" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/enrich/web": {
      post: {
        tags: ["Enrichment"],
        summary: "Gemini grounded web fallback (requires calaAttempted=true)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["conversationId", "query", "calaAttempted"],
                properties: {
                  conversationId: { type: "string" },
                  name: { type: "string" },
                  company: { type: "string" },
                  query: { type: "string" },
                  calaAttempted: { type: "boolean" },
                },
              },
              example: {
                conversationId: "conv_demo",
                company: "Recursive",
                query: "What does Recursive do and what recent funding exists?",
                calaAttempted: true,
              },
            },
          },
        },
        responses: {
          "200": { description: "WebFallbackResponse" },
          "422": { description: "FALLBACK_ORDER_VIOLATION (calaAttempted not true)" },
        },
      },
    },
    "/api/outcomes": {
      get: {
        tags: ["Outcomes"],
        summary: "Current traction summary for the demo user",
        responses: { "200": { description: "TractionSummary" } },
      },
      post: {
        tags: ["Outcomes"],
        summary: "Record an outcome (sent/reply/booked/wtp/paid/...)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contactId", "outcomeType"],
                properties: {
                  userId: { type: "string" },
                  contactId: { type: "string" },
                  recommendationId: { type: "string" },
                  outcomeType: {
                    type: "string",
                    enum: [
                      "sent",
                      "reply",
                      "booked",
                      "paid",
                      "wtp",
                      "ignored",
                      "snoozed",
                      "marked_not_relevant",
                      "manual_override",
                    ],
                  },
                  notes: { type: "string" },
                  value: { type: "number" },
                },
              },
              example: { contactId: "contact_demo", outcomeType: "sent" },
            },
          },
        },
        responses: {
          "200": { description: "OutcomeCreateResponse" },
          "404": { description: "Contact not found" },
        },
      },
    },
    "/api/demo/reset": {
      post: {
        tags: ["Demo"],
        summary: "Wipe and re-seed the in-memory store",
        responses: { "200": { description: "{ ok: true }" } },
      },
    },
  },
  components: {
    schemas: {
      ObjectiveInput: {
        type: "object",
        required: ["role", "primaryGoal"],
        properties: {
          userId: { type: "string" },
          role: {
            type: "string",
            enum: [
              "founder",
              "operator",
              "investor",
              "recruiter",
              "student",
              "job_seeker",
              "sponsor_bd",
              "sales",
              "community_builder",
              "other",
            ],
          },
          primaryGoal: { type: "string" },
          secondaryGoals: { type: "array", items: { type: "string" } },
          activeGoals: { type: "array", items: { type: "string" } },
          eventContext: { type: "string" },
          companyName: { type: "string" },
          attentionBudgetToday: { type: "integer" },
          preferredTone: {
            type: "string",
            enum: ["direct", "warm", "formal", "casual", "concise"],
          },
          constraints: { type: "array", items: { type: "string" } },
        },
      },
      TextCapture: {
        type: "object",
        required: ["rawText"],
        properties: {
          userId: { type: "string" },
          rawText: { type: "string" },
          eventContext: { type: "string" },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
