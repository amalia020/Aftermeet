import { describe, expect, it } from "vitest";
import "./helpers";
import { demoObjective, demoExtractionResult, DEMO_USER_ID } from "@/lib/demo/fixtures";
import {
  ASK_SIZE_BY_ACTION,
  normalizeEnumScore,
  scoreFeature,
  selectDailyMoves,
  toDailyMoveView
} from "@/lib/intelligence/layer5";
import type {
  DailyMoveSelectorInput,
  EvidenceBundle,
  OpportunityRoute,
  RelationshipMoveInput
} from "@/lib/types";

const generatedAt = "2026-06-20T09:00:00.000Z";

function route(type: OpportunityRoute["type"], score: number): OpportunityRoute {
  return {
    id: `route_${type}_${score}`,
    contactId: `contact_${type}_${score}`,
    conversationId: `conv_${type}_${score}`,
    type,
    score,
    evidence: ["Route evidence"],
    why: ["Matches the active objective."],
    whyNot: [],
    createdAt: generatedAt
  };
}

function evidenceBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    requestId: "req_layer5",
    userId: DEMO_USER_ID,
    conversationId: "conv_layer5",
    contactId: "contact_layer5",
    contactCandidate: demoExtractionResult.contactCandidate,
    publicContext: [],
    sourceRecords: [],
    evidenceFacts: [
      {
        id: "fact_conversation_interest",
        conversationId: "conv_layer5",
        fact: "Maya expressed interest in trying AfterMeet at her next event.",
        factType: "product_interest",
        sourceRecordId: "src_conversation",
        sourceType: "user_voice_note",
        entityMatchConfidence: 0.9,
        sourceConfidence: 0.9,
        extractionConfidence: 0.9,
        freshness: 0.9,
        contradictionPenalty: 0,
        factConfidence: 0.9,
        safeForDraft: true,
        isProfessional: true,
        isSensitive: false,
        createdAt: generatedAt
      }
    ],
    entityResolution: {
      score: 0.9,
      label: "high",
      needsUserConfirmation: false,
      reasons: ["Strong fixture match."]
    },
    enrichment: {
      attempted: true,
      calaAttempted: true,
      webFallbackAttempted: false,
      status: "available",
      warnings: []
    },
    ...overrides
  };
}

function relationship(overrides: Partial<RelationshipMoveInput> = {}): RelationshipMoveInput {
  return {
    relationshipId: "rel_maya",
    contactId: "contact_maya",
    userId: DEMO_USER_ID,
    contactName: "Maya Linden",
    company: "Recursive",
    objective: demoObjective,
    conversationAtoms: demoExtractionResult.atoms,
    evidenceBundle: evidenceBundle(),
    topOpportunityRoute: route("user", 0.92),
    actionHistory: {},
    outcomeHistory: [],
    capturedAt: "2026-06-18T09:00:00.000Z",
    lastInteractionAt: "2026-06-18T09:00:00.000Z",
    ...overrides
  };
}

function select(relationships: RelationshipMoveInput[], attentionBudget = 3) {
  const input: DailyMoveSelectorInput = {
    userId: DEMO_USER_ID,
    objective: demoObjective,
    relationships,
    attentionBudget,
    generatedAt
  };
  return selectDailyMoves(input);
}

describe("relationship delta normalizers", () => {
  it("maps known action ask sizes and clamps unknown values", () => {
    expect(ASK_SIZE_BY_ACTION.ask_for_investment).toBe(0.9);
    expect(normalizeEnumScore({ exact: 1 } as Partial<Record<string, number>>, "missing", 0.3)).toBe(0.3);
    expect(normalizeEnumScore({ tooHigh: 3 } as Partial<Record<string, number>>, "tooHigh", 0)).toBe(1);
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

describe("relationship delta daily moves", () => {
  it("ranks a fresh explicit high-fit relationship above a generic warm contact", () => {
    const genericWarm = relationship({
      relationshipId: "rel_designer",
      contactId: "contact_designer",
      contactName: "Friendly Designer",
      company: "Studio",
      topOpportunityRoute: route("other", 0.22),
      conversationAtoms: {
        facts: [{ text: "Had a friendly design chat.", confidence: 0.7, isProfessional: true, isSensitive: false }],
        asks: [],
        offers: [],
        commitments: [],
        uncertainties: [],
        sentiment: "friendly",
        extractionConfidence: 0.75
      },
      evidenceBundle: evidenceBundle({
        contactId: "contact_designer",
        contactCandidate: { name: "Friendly Designer", company: "Studio" },
        evidenceFacts: [],
        entityResolution: {
          score: 0.75,
          label: "medium",
          needsUserConfirmation: false,
          reasons: ["Name match."]
        }
      })
    });

    const moves = select([genericWarm, relationship()]);

    expect(moves[0].contactId).toBe("contact_maya");
    expect(moves[0].recommendedAction).toBe("simple_followup");
    expect(moves[0].whyNow.join(" ")).toContain("warm");
    expect(moves[0].whatToAvoid).toContain("Do not pitch a formal role yet.");
  });

  it("uses confirm details when identity confidence is low", () => {
    const moves = select([
      relationship({
        relationshipId: "rel_uncertain",
        contactId: "contact_uncertain",
        evidenceBundle: evidenceBundle({
          entityResolution: {
            score: 0.35,
            label: "low",
            needsUserConfirmation: true,
            reasons: ["Multiple possible contacts."]
          }
        })
      })
    ]);

    expect(moves[0].recommendedAction).toBe("confirm_details");
    expect(moves[0].risks).toContain("Identity or evidence is uncertain.");
    expect(moves[0].safeFactsForDraft).toEqual([]);
  });

  it("suppresses another outbound nudge after a recent no-response", () => {
    const moves = select([
      relationship({
        relationshipId: "rel_recent_nudge",
        contactId: "contact_recent_nudge",
        actionHistory: {
          lastNudgeAt: "2026-06-19T12:00:00.000Z",
          lastNudgeNoResponse: true,
          hasUserActed: true,
          hasRecipientReplied: false
        }
      })
    ]);

    expect(["wait", "snooze"]).toContain(moves[0].recommendedAction);
    expect(moves[0].whatToAvoid).toContain("Do not send another nudge this week.");
  });

  it("blocks sensitive or creepy public-only facts from draft use", () => {
    const moves = select([
      relationship({
        evidenceBundle: evidenceBundle({
          evidenceFacts: [
            {
              id: "fact_sensitive",
              conversationId: "conv_layer5",
              fact: "Maya has a personal public detail unrelated to the conversation.",
              factType: "personal_public_detail",
              sourceRecordId: "src_public",
              sourceType: "search_snippet",
              entityMatchConfidence: 0.9,
              sourceConfidence: 0.7,
              extractionConfidence: 0.8,
              freshness: 0.8,
              contradictionPenalty: 0,
              factConfidence: 0.85,
              safeForDraft: true,
              isProfessional: false,
              isSensitive: true,
              createdAt: generatedAt
            }
          ]
        })
      })
    ]);

    expect(moves[0].blockedFacts).toContain("Maya has a personal public detail unrelated to the conversation.");
    expect(moves[0].safeFactsForDraft).not.toContain("Maya has a personal public detail unrelated to the conversation.");
  });

  it("respects attention budget and does not add low-priority filler", () => {
    const high = relationship({ relationshipId: "rel_high", contactId: "contact_high" });
    const medium = relationship({
      relationshipId: "rel_medium",
      contactId: "contact_medium",
      topOpportunityRoute: route("partner", 0.7),
      capturedAt: "2026-06-17T09:00:00.000Z"
    });
    const low = relationship({
      relationshipId: "rel_low",
      contactId: "contact_low",
      topOpportunityRoute: route("other", 0.05),
      conversationAtoms: {
        facts: [],
        asks: [],
        offers: [],
        commitments: [],
        uncertainties: ["No clear mission relevance."],
        sentiment: null,
        extractionConfidence: 0.4
      },
      evidenceBundle: evidenceBundle({
        evidenceFacts: [],
        entityResolution: {
          score: 0.5,
          label: "medium",
          needsUserConfirmation: false,
          reasons: ["Partial fixture match."]
        }
      })
    });

    const moves = select([low, high, medium], 1);
    const allQualified = select([low], 3);

    expect(moves).toHaveLength(1);
    expect(moves[0].contactId).toBe("contact_high");
    expect(allQualified).toHaveLength(0);
  });

  it("returns frontend-safe views without internal score traces", () => {
    const [move] = select([relationship()]);
    const view = toDailyMoveView(move);

    expect(view.contactName).toBe("Maya Linden");
    expect(view.priorityLabel).toMatch(/high|medium|low/);
    expect("scoreBreakdown" in view).toBe(false);
    expect("featureTrace" in view).toBe(false);
  });
});
