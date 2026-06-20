import type { JsonValue } from "@/lib/types";
import { demoConversationText, DEMO_USER_ID } from "@/lib/demo/fixtures";

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, JsonValue>;
  components: {
    schemas: Record<string, JsonValue>;
  };
}

const stringSchema = { type: "string" };
const nullableStringSchema = { type: ["string", "null"] };
const scoreSchema = { type: "number", minimum: 0, maximum: 1 };

function ref(schema: string) {
  return { $ref: `#/components/schemas/${schema}` };
}

function jsonRequest(schema: JsonValue, example?: JsonValue) {
  return {
    required: true,
    content: {
      "application/json": {
        schema,
        ...(example ? { example } : {})
      }
    }
  };
}

function jsonResponse(schema: JsonValue, description = "OK", example?: JsonValue) {
  return {
    description,
    content: {
      "application/json": {
        schema,
        ...(example ? { example } : {})
      }
    }
  };
}

function sseResponse(description = "SSE stream of process stage events") {
  return {
    description,
    content: {
      "text/event-stream": {
        schema: {
          type: "string",
          example:
            'data: {"stage":"capturing","status":"started","timestamp":"..."}\n\n'
        }
      }
    }
  };
}

function errorResponses() {
  return {
    "400": jsonResponse(ref("ErrorResponse"), "Validation error"),
    "422": jsonResponse(ref("ErrorResponse"), "Unprocessable request"),
    "500": jsonResponse(ref("ErrorResponse"), "Server error")
  };
}

export function createOpenApiDocument(origin = "http://127.0.0.1:3000"): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "AfterMeet Intelligence Layer API",
      version: "0.1.0",
      description:
        "Capture, extraction, enrichment, and evidence endpoints for the AfterMeet intelligence layer MVP."
    },
    servers: [
      {
        url: origin,
        description: "Current server"
      }
    ],
    tags: [
      { name: "Health", description: "Service status" },
      { name: "Objectives", description: "User objective setup" },
      { name: "Capture", description: "Conversation capture inputs" },
      { name: "Intelligence", description: "Pipeline processing stream" },
      { name: "Enrichment", description: "Cala and web fallback enrichment" },
      { name: "Recommendations", description: "Decision engine and draft generation" },
      { name: "Outcomes", description: "Outcome tracking and traction summaries" },
      { name: "Diagnostics", description: "Provider and demo diagnostics" },
      { name: "Demo", description: "Demo store utilities" },
      {
        name: "Workflows",
        description: "Single-call orchestration for objective, capture, and enrichment"
      }
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Check service health",
          responses: {
            "200": jsonResponse(ref("HealthResponse"), "Service is healthy")
          }
        }
      },
      "/api/demo/reset": {
        post: {
          tags: ["Demo"],
          summary: "Reset the in-memory demo store",
          description:
            "Wipes and re-seeds the local demo store so Swagger smoke tests can be rerun from a clean state.",
          responses: {
            "200": jsonResponse(ref("OkResponse"), "Demo store reset")
          }
        }
      },
      "/api/diagnostics/providers": {
        get: {
          tags: ["Diagnostics"],
          summary: "Probe configured external providers",
          description:
            "Calls tiny live probes for Cala and Gemini, reports OpenAI Whisper configuration, and checks the Mollie payment link configuration.",
          responses: {
            "200": jsonResponse(ref("ProviderDiagnosticsResponse")),
            ...errorResponses()
          }
        }
      },
      "/api/objectives": {
        get: {
          tags: ["Objectives"],
          summary: "Get the active objective for a user",
          parameters: [
            {
              name: "userId",
              in: "query",
              required: true,
              schema: stringSchema,
              example: DEMO_USER_ID
            }
          ],
          responses: {
            "200": jsonResponse(ref("ActiveObjectiveResponse")),
            ...errorResponses()
          }
        },
        post: {
          tags: ["Objectives"],
          summary: "Create or update an objective",
          requestBody: jsonRequest(ref("ObjectiveSaveRequest"), {
            userId: DEMO_USER_ID,
            role: "founder",
            primaryGoal: "find_users",
            activeGoals: ["find_users", "find_design_partners"],
            secondaryGoals: ["find_design_partners"],
            eventContext: "MEGATHON",
            companyName: "AfterMeet",
            productDescription: "Relationship intelligence for networking events",
            targetCustomer: "Event-heavy founders and operators",
            attentionBudgetToday: 5,
            preferredTone: "warm",
            constraints: ["Do not auto-send messages"]
          }),
          responses: {
            "201": jsonResponse(ref("ObjectiveSaveResponse"), "Objective saved"),
            ...errorResponses()
          }
        }
      },
      "/api/capture/text": {
        post: {
          tags: ["Capture"],
          summary: "Capture a text conversation note",
          requestBody: jsonRequest(ref("TextCaptureRequest"), {
            userId: DEMO_USER_ID,
            rawText: demoConversationText,
            eventContext: "MEGATHON"
          }),
          responses: {
            "202": jsonResponse(ref("CaptureAcceptedResponse"), "Capture accepted"),
            ...errorResponses()
          }
        }
      },
      "/api/capture/voice": {
        post: {
          tags: ["Capture"],
          summary: "Capture a voice note",
          description:
            "Uses multipart/form-data. OpenAI remains the voice transcription provider; fixture transcription is used when no key is configured.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    userId: stringSchema,
                    audioFile: { type: "string", format: "binary" },
                    eventContext: stringSchema,
                    capturedAt: stringSchema
                  },
                  required: ["userId", "audioFile"]
                }
              }
            }
          },
          responses: {
            "202": jsonResponse(ref("VoiceCaptureAcceptedResponse"), "Voice capture accepted"),
            ...errorResponses()
          }
        }
      },
      "/api/capture/card": {
        post: {
          tags: ["Capture"],
          summary: "Capture a business card with manual fallback",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("CardCaptureRequest"),
                example: {
                  userId: DEMO_USER_ID,
                  manualTextFallback: "Maya from Recursive, interested in AfterMeet.",
                  eventContext: "MEGATHON"
                }
              },
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    userId: stringSchema,
                    imageFile: { type: "string", format: "binary" },
                    manualTextFallback: stringSchema,
                    eventContext: stringSchema
                  },
                  required: ["userId"]
                }
              }
            }
          },
          responses: {
            "202": jsonResponse(ref("CardCaptureAcceptedResponse"), "Card capture accepted"),
            ...errorResponses()
          }
        }
      },
      "/api/intelligence/process": {
        get: {
          tags: ["Intelligence"],
          summary: "Stream processing events for an existing conversation",
          description:
            "GET form used by capture streamUrl. Requires conversationId and returns an SSE stream of ProcessStageEvent objects.",
          parameters: [
            {
              name: "conversationId",
              in: "query",
              required: true,
              schema: stringSchema,
              example: "conv_replace_me"
            },
            {
              name: "requestId",
              in: "query",
              required: false,
              schema: stringSchema,
              example: "req_replace_me"
            }
          ],
          responses: {
            "200": sseResponse(),
            ...errorResponses()
          }
        },
        post: {
          tags: ["Intelligence"],
          summary: "Process a captured conversation",
          description:
            "Returns an SSE stream. Swagger UI will show the raw streamed data events in the response body.",
          requestBody: jsonRequest(ref("ProcessConversationRequestBody"), {
            requestId: "req_replace_me",
            userId: DEMO_USER_ID,
            conversationId: "conv_replace_me",
            captureType: "text"
          }),
          responses: {
            "200": sseResponse(),
            ...errorResponses()
          }
        }
      },
      "/api/enrich/cala": {
        post: {
          tags: ["Enrichment"],
          summary: "Debug Cala enrichment for a captured conversation",
          requestBody: jsonRequest(ref("CalaEnrichmentRequest"), {
            userId: DEMO_USER_ID,
            conversationId: "conv_replace_me",
            name: "Maya Linden",
            company: "Recursive",
            role: "Founder",
            query: "Recursive professional company context"
          }),
          responses: {
            "200": jsonResponse(ref("CalaEnrichmentResponse")),
            ...errorResponses()
          }
        }
      },
      "/api/enrich/web": {
        post: {
          tags: ["Enrichment"],
          summary: "Debug Gemini grounded web fallback enrichment",
          description: "Requires `calaAttempted: true`; this enforces Cala-first ordering.",
          requestBody: jsonRequest(ref("WebFallbackRequest"), {
            userId: DEMO_USER_ID,
            conversationId: "conv_replace_me",
            name: "Maya Linden",
            company: "Recursive",
            role: "Founder",
            query: "Recursive professional context",
            calaAttempted: true,
            calaMatchConfidence: 0.2,
            allowUncitedClaims: false
          }),
          responses: {
            "200": jsonResponse(ref("WebFallbackResponse")),
            ...errorResponses()
          }
        }
      },
      "/api/intelligence/recommend": {
        post: {
          tags: ["Recommendations"],
          summary: "Run the decision engine for an evidence bundle",
          description:
            "Returns a RecommendationPackage. If no evidenceBundle is supplied, the demo evidence bundle is used so the endpoint remains Swagger-testable.",
          requestBody: jsonRequest(ref("RecommendRequest"), {
            userId: DEMO_USER_ID,
            conversationId: "conv_replace_me",
            status: "new",
            hoursSinceLastAction: 0
          }),
          responses: {
            "200": jsonResponse(ref("RecommendationPackage")),
            ...errorResponses()
          }
        }
      },
      "/api/draft/generate": {
        post: {
          tags: ["Recommendations"],
          summary: "Generate an editable draft for an existing recommendation",
          description:
            "Loads a recommendation, applies the draft gate, and returns a draft. It never auto-sends.",
          requestBody: jsonRequest(ref("DraftGenerateRequest"), {
            userId: DEMO_USER_ID,
            recommendationId: "rec_replace_me",
            tone: "warm"
          }),
          responses: {
            "200": jsonResponse(ref("DraftGenerateResponse")),
            "403": jsonResponse(ref("ErrorResponse"), "Draft is not allowed for this action"),
            "404": jsonResponse(ref("ErrorResponse"), "Recommendation not found"),
            ...errorResponses()
          }
        }
      },
      "/api/outcomes": {
        get: {
          tags: ["Outcomes"],
          summary: "Get the current demo traction summary",
          responses: {
            "200": jsonResponse(ref("TractionSummary")),
            ...errorResponses()
          }
        },
        post: {
          tags: ["Outcomes"],
          summary: "Record a manual outcome and update traction",
          requestBody: jsonRequest(ref("OutcomeCreateRequest"), {
            userId: DEMO_USER_ID,
            contactId: "contact_replace_me",
            recommendationId: "rec_replace_me",
            outcomeType: "reply",
            notes: "They replied and asked for a demo.",
            value: 1
          }),
          responses: {
            "201": jsonResponse(ref("OutcomeCreateResponse"), "Outcome recorded"),
            "404": jsonResponse(ref("ErrorResponse"), "Contact not found"),
            ...errorResponses()
          }
        }
      },
      "/api/workflows/capture-enrich": {
        post: {
          tags: ["Workflows"],
          summary: "Run objective -> capture -> Cala enrichment in one call",
          description:
            "Useful for Swagger testing. Ensures objective when needed, captures the conversation, then runs Cala enrichment. If Cala has no match, web fallback runs automatically unless includeWebFallback is explicitly false.",
          requestBody: jsonRequest(ref("WorkflowCaptureEnrichRequest"), {
            userId: DEMO_USER_ID,
            rawText:
              "I met Tom Nicholson from Cala. We discussed how AfterMeet could support high-density networking workflows.",
            eventContext: "MEGATHON",
            name: "Tom Nicholson",
            company: "Cala",
            role: "Operator",
            query: "Tom Nicholson Cala professional context",
            includeWebFallback: true,
            allowUncitedClaims: true,
            ensureObjective: true
          }),
          responses: {
            "200": jsonResponse(ref("WorkflowCaptureEnrichResponse")),
            ...errorResponses()
          }
        }
      },
      "/api/workflows/capture-web-fallback": {
        post: {
          tags: ["Workflows"],
          summary: "Run objective -> capture -> Gemini web fallback in one call",
          description:
            "Useful when you only want to test web fallback behavior without Cala enrichment.",
          requestBody: jsonRequest(ref("WorkflowCaptureWebFallbackRequest"), {
            userId: DEMO_USER_ID,
            rawText:
              "I met Tom Nicholson from Cala. We discussed how AfterMeet could support high-density networking workflows.",
            eventContext: "MEGATHON",
            name: "Tom Nicholson",
            company: "Cala",
            role: "Operator",
            query: "Tom Nicholson Cala professional context",
            allowUncitedClaims: true,
            ensureObjective: true
          }),
          responses: {
            "200": jsonResponse(ref("WorkflowCaptureWebFallbackResponse")),
            ...errorResponses()
          }
        }
      },
      "/api/workflows/full-flow": {
        post: {
          tags: ["Workflows"],
          summary: "Run objective -> capture -> extraction -> enrichment -> recommendation in one JSON call",
          description:
            "Best Swagger smoke test for the whole intelligence layer. This avoids the SSE stream and returns the capture, extraction handoff, evidence bundle, recommendation package, draft, and stage events as JSON.",
          requestBody: jsonRequest(ref("WorkflowFullFlowRequest"), {
            userId: DEMO_USER_ID,
            rawText: demoConversationText,
            eventContext: "MEGATHON",
            name: "Maya",
            company: "Recursive",
            role: "Founder",
            query: "Recursive professional company context",
            ensureObjective: true,
            status: "new",
            hoursSinceLastAction: 0
          }),
          responses: {
            "200": jsonResponse(ref("WorkflowFullFlowResponse")),
            ...errorResponses()
          }
        }
      }
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: stringSchema,
            message: stringSchema,
            details: { type: "object", additionalProperties: stringSchema },
            requestId: stringSchema
          },
          required: ["error", "message"]
        },
        OkResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" }
          },
          required: ["ok"]
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            service: stringSchema,
            demoMode: { type: "boolean" },
            providers: {
              type: "object",
              properties: {
                cala: { type: "boolean" },
                gemini: { type: "boolean" },
                whisper: { type: "boolean" },
                openai: { type: "boolean" },
                mollie: { type: "boolean" }
              },
              required: ["cala", "gemini", "whisper", "openai", "mollie"]
            },
            timestamp: stringSchema
          },
          required: ["status", "service", "demoMode", "providers", "timestamp"]
        },
        ProviderProbeResult: {
          type: "object",
          properties: {
            provider: stringSchema,
            configured: { type: "boolean" },
            mode: { type: "string", enum: ["live", "fallback", "skipped"] },
            ok: { type: "boolean" },
            detail: stringSchema,
            warnings: { type: "array", items: stringSchema },
            sample: {}
          },
          required: ["provider", "configured", "mode", "ok", "detail"]
        },
        ProviderDiagnosticsResponse: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                live: { type: "integer" },
                total: { type: "integer" },
                allConfiguredLive: { type: "boolean" }
              },
              required: ["live", "total", "allConfiguredLive"]
            },
            results: { type: "array", items: ref("ProviderProbeResult") },
            timestamp: stringSchema
          },
          required: ["summary", "results", "timestamp"]
        },
        UserObjectiveProfile: {
          type: "object",
          properties: {
            id: stringSchema,
            userId: stringSchema,
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
                "other"
              ]
            },
            activeGoals: { type: "array", items: stringSchema },
            primaryGoal: stringSchema,
            secondaryGoals: { type: "array", items: stringSchema },
            eventContext: nullableStringSchema,
            companyName: nullableStringSchema,
            companyStage: nullableStringSchema,
            productDescription: nullableStringSchema,
            targetCustomer: nullableStringSchema,
            currentTraction: nullableStringSchema,
            fundraisingStatus: nullableStringSchema,
            hiringNeeds: { type: "array", items: stringSchema },
            attentionBudgetToday: { type: "integer" },
            preferredTone: {
              type: "string",
              enum: ["direct", "warm", "formal", "casual", "concise"]
            },
            constraints: { type: "array", items: stringSchema },
            createdAt: stringSchema,
            updatedAt: stringSchema
          },
          required: [
            "id",
            "userId",
            "role",
            "activeGoals",
            "primaryGoal",
            "secondaryGoals",
            "attentionBudgetToday",
            "preferredTone",
            "constraints",
            "createdAt",
            "updatedAt"
          ]
        },
        ObjectiveSaveRequest: {
          type: "object",
          properties: {
            id: stringSchema,
            userId: stringSchema,
            role: stringSchema,
            activeGoals: { type: "array", items: stringSchema },
            primaryGoal: stringSchema,
            secondaryGoals: { type: "array", items: stringSchema },
            eventContext: nullableStringSchema,
            companyName: nullableStringSchema,
            companyStage: nullableStringSchema,
            productDescription: nullableStringSchema,
            targetCustomer: nullableStringSchema,
            currentTraction: nullableStringSchema,
            fundraisingStatus: nullableStringSchema,
            hiringNeeds: { type: "array", items: stringSchema },
            attentionBudgetToday: { type: "integer" },
            preferredTone: stringSchema,
            constraints: { type: "array", items: stringSchema },
            userId_note: {
              type: "string",
              description: "Use userId=user_demo_aftermeet for the seeded demo user."
            }
          },
          required: ["userId", "role", "primaryGoal"]
        },
        ActiveObjectiveResponse: {
          type: "object",
          properties: {
            objective: { oneOf: [ref("UserObjectiveProfile"), { type: "null" }] }
          },
          required: ["objective"]
        },
        ObjectiveSaveResponse: {
          type: "object",
          properties: { objective: ref("UserObjectiveProfile") },
          required: ["objective"]
        },
        TextCaptureRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            rawText: stringSchema,
            eventContext: stringSchema,
            capturedAt: stringSchema
          },
          required: ["userId", "rawText"]
        },
        CardCaptureRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            imageFile: stringSchema,
            manualTextFallback: stringSchema,
            eventContext: stringSchema
          },
          required: ["userId"]
        },
        CaptureAcceptedResponse: {
          type: "object",
          properties: {
            requestId: stringSchema,
            conversationId: stringSchema,
            status: { type: "string", enum: ["captured", "processing"] },
            streamUrl: stringSchema
          },
          required: ["requestId", "conversationId", "status"]
        },
        VoiceCaptureAcceptedResponse: {
          allOf: [
            ref("CaptureAcceptedResponse"),
            {
              type: "object",
              properties: {
                transcriptStatus: {
                  type: "string",
                  enum: ["pending", "completed", "fallback_required"]
                }
              },
              required: ["transcriptStatus"]
            }
          ]
        },
        CardCaptureAcceptedResponse: {
          allOf: [
            ref("CaptureAcceptedResponse"),
            {
              type: "object",
              properties: {
                cardStatus: { type: "string", enum: ["captured", "manual_fallback"] }
              },
              required: ["cardStatus"]
            }
          ]
        },
        ProcessConversationRequestBody: {
          type: "object",
          properties: {
            requestId: stringSchema,
            userId: stringSchema,
            conversationId: stringSchema,
            captureType: { type: "string", enum: ["text", "voice", "card"] },
            rawText: stringSchema,
            transcript: stringSchema,
            cardText: stringSchema,
            eventContext: stringSchema
          },
          required: ["requestId", "userId", "captureType"]
        },
        ContactCandidate: {
          type: "object",
          properties: {
            name: nullableStringSchema,
            role: nullableStringSchema,
            company: nullableStringSchema,
            email: nullableStringSchema,
            phone: nullableStringSchema,
            website: nullableStringSchema,
            linkedinUrl: nullableStringSchema
          }
        },
        PublicEntityContext: {
          type: "object",
          properties: {
            id: stringSchema,
            contactId: nullableStringSchema,
            provider: { type: "string", enum: ["cala", "gemini", "web", "manual"] },
            providerEntityId: nullableStringSchema,
            entityType: { type: "string", enum: ["person", "company", "fund", "unknown"] },
            canonicalName: nullableStringSchema,
            rawContext: {},
            retrievedAt: stringSchema,
            confidence: scoreSchema
          }
        },
        SourceRecord: {
          type: "object",
          properties: {
            id: stringSchema,
            contactId: nullableStringSchema,
            provider: { type: "string" },
            sourceType: { type: "string" },
            sourceName: nullableStringSchema,
            sourceUrl: nullableStringSchema,
            retrievedAt: stringSchema,
            sourceConfidence: scoreSchema,
            notes: nullableStringSchema
          }
        },
        CalaEntityCandidate: {
          type: "object",
          properties: {
            providerEntityId: stringSchema,
            name: stringSchema,
            entityType: stringSchema,
            company: stringSchema,
            role: stringSchema,
            domain: stringSchema,
            confidence: scoreSchema
          },
          required: ["providerEntityId", "name", "entityType"]
        },
        CalaEnrichmentRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            contactId: stringSchema,
            conversationId: stringSchema,
            name: stringSchema,
            company: stringSchema,
            role: stringSchema,
            query: stringSchema
          },
          required: ["userId", "conversationId"]
        },
        CalaEnrichmentResponse: {
          type: "object",
          properties: {
            available: { type: "boolean" },
            candidates: { type: "array", items: ref("CalaEntityCandidate") },
            selectedContext: ref("PublicEntityContext"),
            entityMatchConfidence: scoreSchema,
            sourceRecords: { type: "array", items: ref("SourceRecord") },
            warnings: { type: "array", items: stringSchema }
          },
          required: [
            "available",
            "candidates",
            "entityMatchConfidence",
            "sourceRecords",
            "warnings"
          ]
        },
        WebContextClaim: {
          type: "object",
          properties: {
            text: stringSchema,
            sourceUrl: stringSchema,
            sourceType: stringSchema
          },
          required: ["text", "sourceUrl", "sourceType"]
        },
        WebFallbackRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            contactId: stringSchema,
            conversationId: stringSchema,
            name: stringSchema,
            company: stringSchema,
            role: stringSchema,
            query: stringSchema,
            calaAttempted: { type: "boolean", const: true },
            calaMatchConfidence: scoreSchema,
            allowUncitedClaims: {
              type: "boolean",
              description:
                "When true, accepts claims without sourceUrl as temporary fallback evidence."
            }
          },
          required: ["userId", "conversationId", "query", "calaAttempted"]
        },
        WebFallbackResponse: {
          type: "object",
          properties: {
            available: { type: "boolean" },
            summary: stringSchema,
            claims: { type: "array", items: ref("WebContextClaim") },
            sourceRecords: { type: "array", items: ref("SourceRecord") },
            warnings: { type: "array", items: stringSchema }
          },
          required: ["available", "summary", "claims", "sourceRecords", "warnings"]
        },
        RecommendRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            conversationId: stringSchema,
            contactId: stringSchema,
            evidenceBundle: {
              type: "object",
              description: "Optional Part 2 EvidenceBundle. Demo evidence is used when omitted."
            },
            objective: ref("UserObjectiveProfile"),
            status: {
              type: "string",
              enum: ["new", "drafted", "sent", "reply", "booked", "archived"]
            },
            hoursSinceLastAction: { type: "number" }
          },
          required: ["userId"]
        },
        ActionRecommendation: {
          type: "object",
          properties: {
            id: stringSchema,
            userId: stringSchema,
            contactId: stringSchema,
            conversationId: stringSchema,
            recommendedAction: stringSchema,
            priorityScore: scoreSchema,
            urgencyScore: scoreSchema,
            recipientBurden: scoreSchema,
            confidence: scoreSchema,
            status: {
              type: "string",
              enum: ["pending", "accepted", "sent", "snoozed", "archived", "overridden"]
            },
            explanation: {
              type: "object",
              description: "DecisionTrace explaining route scores, chosen action, and safe facts."
            },
            createdAt: stringSchema
          },
          required: [
            "id",
            "userId",
            "contactId",
            "conversationId",
            "recommendedAction",
            "priorityScore",
            "urgencyScore",
            "recipientBurden",
            "confidence",
            "status",
            "explanation",
            "createdAt"
          ]
        },
        RecommendationPackage: {
          type: "object",
          properties: {
            recommendation: ref("ActionRecommendation"),
            decisionTrace: {
              type: "object",
              description: "DecisionTrace used to explain why this action was selected."
            },
            routeScores: {
              type: "array",
              items: {
                type: "object",
                description: "OpportunityRoute scored by the decision engine."
              }
            },
            draft: {
              oneOf: [ref("Draft"), { type: "null" }]
            },
            boardCard: {
              type: "object",
              description: "FollowUpBoardCard for clients that render queues."
            },
            warnings: { type: "array", items: stringSchema }
          },
          required: ["recommendation", "decisionTrace", "routeScores", "boardCard", "warnings"]
        },
        DraftGenerateRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            recommendationId: stringSchema,
            tone: {
              type: "string",
              enum: ["direct", "warm", "formal", "casual", "concise"]
            }
          },
          required: ["recommendationId"]
        },
        Draft: {
          type: "object",
          properties: {
            id: stringSchema,
            recommendationId: stringSchema,
            contactId: stringSchema,
            channel: { type: "string", enum: ["email", "linkedin", "sms", "manual"] },
            tone: nullableStringSchema,
            subject: nullableStringSchema,
            body: stringSchema,
            factsUsed: { type: "array", items: stringSchema },
            status: { type: "string", enum: ["drafted", "edited", "sent", "discarded"] },
            riskNote: nullableStringSchema,
            createdAt: stringSchema,
            sentAt: nullableStringSchema
          },
          required: [
            "id",
            "recommendationId",
            "contactId",
            "channel",
            "body",
            "factsUsed",
            "status",
            "createdAt"
          ]
        },
        DraftGenerateResponse: {
          type: "object",
          properties: {
            draft: ref("Draft"),
            factsUsed: { type: "array", items: stringSchema },
            riskNote: nullableStringSchema
          },
          required: ["draft", "factsUsed"]
        },
        OutcomeType: {
          type: "string",
          enum: [
            "sent",
            "reply",
            "booked",
            "paid",
            "wtp",
            "ignored",
            "snoozed",
            "details_confirmed",
            "marked_not_relevant",
            "manual_override"
          ]
        },
        Outcome: {
          type: "object",
          properties: {
            id: stringSchema,
            userId: stringSchema,
            contactId: stringSchema,
            recommendationId: nullableStringSchema,
            outcomeType: ref("OutcomeType"),
            notes: nullableStringSchema,
            value: { type: ["number", "null"] },
            createdAt: stringSchema
          },
          required: ["id", "userId", "contactId", "outcomeType", "createdAt"]
        },
        OutcomeCreateRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            contactId: stringSchema,
            recommendationId: stringSchema,
            outcomeType: ref("OutcomeType"),
            notes: stringSchema,
            value: { type: "number" }
          },
          required: ["contactId", "outcomeType"]
        },
        TractionSummary: {
          type: "object",
          properties: {
            followUpsSent: { type: "integer" },
            repliesReceived: { type: "integer" },
            bookedMeetings: { type: "integer" },
            wtpSignals: { type: "integer" },
            paidCommits: { type: "integer" },
            replyRateByOpportunityType: {
              type: "object",
              additionalProperties: scoreSchema
            },
            actionsCompleted: { type: "integer" },
            contactsArchivedOrIgnored: { type: "integer" }
          },
          required: [
            "followUpsSent",
            "repliesReceived",
            "bookedMeetings",
            "wtpSignals",
            "paidCommits",
            "replyRateByOpportunityType",
            "actionsCompleted",
            "contactsArchivedOrIgnored"
          ]
        },
        OutcomeCreateResponse: {
          type: "object",
          properties: {
            outcome: ref("Outcome"),
            updatedRecommendation: ref("ActionRecommendation"),
            updatedTraction: ref("TractionSummary")
          },
          required: ["outcome", "updatedTraction"]
        },
        WorkflowObjectiveSeed: {
          type: "object",
          properties: {
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
                "other"
              ]
            },
            primaryGoal: stringSchema,
            activeGoals: { type: "array", items: stringSchema },
            secondaryGoals: { type: "array", items: stringSchema },
            eventContext: stringSchema,
            companyName: stringSchema,
            productDescription: stringSchema,
            targetCustomer: stringSchema,
            attentionBudgetToday: { type: "integer" },
            preferredTone: {
              type: "string",
              enum: ["direct", "warm", "formal", "casual", "concise"]
            },
            constraints: { type: "array", items: stringSchema }
          }
        },
        WorkflowCaptureEnrichRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            rawText: stringSchema,
            eventContext: stringSchema,
            capturedAt: stringSchema,
            name: stringSchema,
            company: stringSchema,
            role: stringSchema,
            query: stringSchema,
              includeWebFallback: {
                type: "boolean",
                description:
                  "When true, always run web fallback. When false, disable it. When omitted, it runs automatically if Cala has no match."
              },
              allowUncitedClaims: {
                type: "boolean",
                description:
                  "Forwarded to /api/enrich/web. When true (default in workflow), uncited claims are accepted temporarily."
              },
            ensureObjective: { type: "boolean" },
            objectiveSeed: ref("WorkflowObjectiveSeed")
          },
          required: ["userId", "rawText"]
        },
        WorkflowCaptureEnrichResponse: {
          type: "object",
          properties: {
            objective: {
              type: "object",
              properties: {
                existed: { type: "boolean" },
                created: { type: "boolean" },
                objectiveId: stringSchema
              },
              required: ["existed", "created", "objectiveId"]
            },
            capture: ref("CaptureAcceptedResponse"),
            cala: ref("CalaEnrichmentResponse"),
            webFallback: ref("WebFallbackResponse")
          },
          required: ["objective", "capture", "cala"]
        },
        WorkflowCaptureWebFallbackRequest: {
          type: "object",
          properties: {
            userId: stringSchema,
            rawText: stringSchema,
            eventContext: stringSchema,
            capturedAt: stringSchema,
            name: stringSchema,
            company: stringSchema,
            role: stringSchema,
            query: stringSchema,
            allowUncitedClaims: {
              type: "boolean",
              description:
                "Forwarded to /api/enrich/web. When true, uncited claims are accepted temporarily."
            },
            ensureObjective: { type: "boolean" },
            objectiveSeed: ref("WorkflowObjectiveSeed")
          },
          required: ["userId", "rawText"]
        },
        WorkflowCaptureWebFallbackResponse: {
          type: "object",
          properties: {
            objective: {
              type: "object",
              properties: {
                existed: { type: "boolean" },
                created: { type: "boolean" },
                objectiveId: stringSchema
              },
              required: ["existed", "created", "objectiveId"]
            },
            capture: ref("CaptureAcceptedResponse"),
            webFallback: ref("WebFallbackResponse")
          },
          required: ["objective", "capture", "webFallback"]
        },
        WorkflowFullFlowRequest: {
          allOf: [
            ref("WorkflowCaptureEnrichRequest"),
            {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: [
                    "new",
                    "drafted",
                    "sent",
                    "reply",
                    "booked",
                    "archived"
                  ]
                },
                hoursSinceLastAction: { type: "number" }
              }
            }
          ]
        },
        WorkflowFullFlowResponse: {
          type: "object",
          properties: {
            objective: {
              type: "object",
              properties: {
                existed: { type: "boolean" },
                created: { type: "boolean" },
                objectiveId: stringSchema
              },
              required: ["existed", "created", "objectiveId"]
            },
            capture: ref("CaptureAcceptedResponse"),
            extractionHandoff: {
              type: "object",
              description: "Part 1 -> Part 2 handoff object."
            },
            evidenceBundle: {
              type: "object",
              description: "Part 2 evidence bundle."
            },
            recommendationPackage: {
              type: "object",
              description: "Part 3 recommendation package, including draft when available."
            },
            events: {
              type: "array",
              items: {
                type: "object",
                description: "ProcessStageEvent emitted by the non-streaming workflow."
              }
            }
          },
          required: [
            "objective",
            "capture",
            "extractionHandoff",
            "evidenceBundle",
            "recommendationPackage",
            "events"
          ]
        }
      }
    }
  };
}
