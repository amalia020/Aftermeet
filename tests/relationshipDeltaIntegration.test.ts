import { describe, expect, it } from "vitest";
import { json } from "./helpers";
import { POST as postOutcome } from "@/app/api/outcomes/route";
import {
  DEMO_CONTACT_ID,
  DEMO_CONVERSATION_ID,
  DEMO_USER_ID,
  demoObjective,
  demoExtractionResult,
  part2DemoEvidenceBundle,
  part3DemoRecommendationPackage
} from "@/lib/demo/fixtures";
import {
  saveConversationAtoms,
  saveEvidenceBundle,
  saveRecommendation,
  upsertObjective,
  upsertContact
} from "@/lib/db/queries";
import { buildRelationshipMoveInputs, selectStoredDailyMoves } from "@/lib/intelligence/layer5/adapters";
import {
  getDailyBriefViewModel,
  getPersonIntelligenceViewModel,
  getRelationshipBoardViewModel
} from "@/lib/frontend/viewModels";
import type { ActionRecommendation, Contact, EvidenceBundle, OutcomeCreateResponse } from "@/lib/types";

const generatedAt = "2026-06-20T10:30:00.000Z";

function saveDemoContact(overrides: Partial<Contact> = {}) {
  upsertContact({
    id: DEMO_CONTACT_ID,
    userId: DEMO_USER_ID,
    name: "Maya",
    role: "Founder / CEO",
    company: "Recursive",
    email: null,
    phone: null,
    website: null,
    linkedinUrl: null,
    sourceType: "manual",
    entityMatchConfidence: 0.74,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    ...overrides
  });
}

function saveDemoRelationship(input: {
  contact?: Partial<Contact>;
  bundle?: Partial<EvidenceBundle>;
  recommendation?: Partial<ActionRecommendation>;
} = {}) {
  upsertObjective(demoObjective);
  saveDemoContact(input.contact);
  saveConversationAtoms({
    conversationId: DEMO_CONVERSATION_ID,
    atoms: demoExtractionResult.atoms
  });
  saveEvidenceBundle({
    ...part2DemoEvidenceBundle,
    ...input.bundle,
    contactId: input.bundle?.contactId ?? DEMO_CONTACT_ID,
    conversationId: input.bundle?.conversationId ?? DEMO_CONVERSATION_ID
  });
  saveRecommendation({
    ...part3DemoRecommendationPackage.recommendation,
    ...input.recommendation,
    userId: DEMO_USER_ID,
    contactId: input.recommendation?.contactId ?? DEMO_CONTACT_ID,
    conversationId: input.recommendation?.conversationId ?? DEMO_CONVERSATION_ID
  });
}

describe("Part 5 stored adapter", () => {
  it("builds relationship move inputs from live DB state", () => {
    saveDemoRelationship();

    const relationships = buildRelationshipMoveInputs({
      userId: DEMO_USER_ID,
      generatedAt
    });

    expect(relationships).toHaveLength(1);
    expect(relationships[0].contactId).toBe(DEMO_CONTACT_ID);
    expect(relationships[0].conversationAtoms.offers[0]?.text).toContain("try AfterMeet");
    expect(relationships[0].topOpportunityRoute.type).toBe("user");
  });

  it("selects confirm-first for low identity confidence", () => {
    saveDemoRelationship({
      bundle: {
        entityResolution: {
          ...part2DemoEvidenceBundle.entityResolution,
          score: 0.32,
          label: "low",
          needsUserConfirmation: true,
          reasons: ["Only first name was captured."]
        }
      }
    });

    const moves = selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt });

    expect(moves[0].recommendedAction).toBe("confirm_details");
    expect(moves[0].risks).toContain("Identity or evidence is uncertain.");
  });

  it("clears confirm-first moves after details are confirmed", async () => {
    saveDemoRelationship({
      bundle: {
        entityResolution: {
          ...part2DemoEvidenceBundle.entityResolution,
          score: 0.32,
          label: "low",
          needsUserConfirmation: true,
          reasons: ["Only first name was captured."]
        }
      }
    });

    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })[0].recommendedAction)
      .toBe("confirm_details");

    const response = await postOutcome(
      new Request("http://test/api/outcomes", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          contactId: DEMO_CONTACT_ID,
          recommendationId: part3DemoRecommendationPackage.recommendation.id,
          outcomeType: "details_confirmed"
        })
      })
    );
    const body = await json<OutcomeCreateResponse>(response);

    expect(response.status).toBe(201);
    expect(body.outcome.outcomeType).toBe("details_confirmed");
    expect(body.updatedRecommendation?.status).toBe("overridden");
    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(0);
  });

  it("clears daily moves after they are snoozed", async () => {
    saveDemoRelationship();

    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(1);

    const response = await postOutcome(
      new Request("http://test/api/outcomes", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          contactId: DEMO_CONTACT_ID,
          recommendationId: part3DemoRecommendationPackage.recommendation.id,
          outcomeType: "snoozed"
        })
      })
    );
    const body = await json<OutcomeCreateResponse>(response);

    expect(response.status).toBe(201);
    expect(body.outcome.outcomeType).toBe("snoozed");
    expect(body.updatedRecommendation?.status).toBe("snoozed");
    expect(buildRelationshipMoveInputs({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(0);
    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(0);
  });

  it("clears daily moves after they are marked not relevant", async () => {
    saveDemoRelationship();

    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(1);

    const response = await postOutcome(
      new Request("http://test/api/outcomes", {
        method: "POST",
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          contactId: DEMO_CONTACT_ID,
          recommendationId: part3DemoRecommendationPackage.recommendation.id,
          outcomeType: "marked_not_relevant"
        })
      })
    );
    const body = await json<OutcomeCreateResponse>(response);

    expect(response.status).toBe(201);
    expect(body.outcome.outcomeType).toBe("marked_not_relevant");
    expect(body.updatedRecommendation?.status).toBe("archived");
    expect(buildRelationshipMoveInputs({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(0);
    expect(selectStoredDailyMoves({ userId: DEMO_USER_ID, generatedAt })).toHaveLength(0);
  });
});

describe("Part 5 frontend view models", () => {
  it("uses Part 5 daily moves in the brief without low-priority filler", () => {
    saveDemoRelationship();
    saveDemoRelationship({
      contact: {
        id: "contact_low",
        name: "Friendly Designer",
        company: "Studio",
        role: "Designer"
      },
      bundle: {
        requestId: "req_low",
        contactId: "contact_low",
        conversationId: "conv_low",
        evidenceFacts: [],
        entityResolution: {
          ...part2DemoEvidenceBundle.entityResolution,
          score: 0.5,
          label: "medium",
          reasons: ["Partial match."]
        }
      },
      recommendation: {
        id: "rec_low",
        contactId: "contact_low",
        conversationId: "conv_low",
        priorityScore: 0.05,
        urgencyScore: 0.05,
        explanation: {
          ...part3DemoRecommendationPackage.decisionTrace,
          chosenRoute: {
            ...part3DemoRecommendationPackage.decisionTrace.chosenRoute,
            type: "other",
            score: 0.05
          },
          routeScores: [{
            ...part3DemoRecommendationPackage.decisionTrace.chosenRoute,
            id: "route_low",
            contactId: "contact_low",
            conversationId: "conv_low",
            type: "other",
            score: 0.05
          }]
        }
      }
    });

    const brief = getDailyBriefViewModel(DEMO_USER_ID);

    expect(brief.moves).toHaveLength(1);
    expect(brief.moves[0].name).toBe("Maya");
    expect(brief.moves[0].whyNow[0]).toContain("warm");
    expect(brief.moves[0].whatToAvoid.join(" ")).toContain("Do not");
    expect(brief.headline).toContain("best move");
  });

  it("groups Part 5 moves into daily policy board lanes", () => {
    saveDemoRelationship();

    const board = getRelationshipBoardViewModel(DEMO_USER_ID);

    expect(board.sections.map((section) => section.title)).toEqual([
      "Act Today",
      "Confirm First",
      "Waiting",
      "Cooling",
      "Dormant"
    ]);
    expect(board.sections[0].cards[0].name).toBe("Maya");
    expect(board.sections[0].cards[0].note).toContain("warm");
  });

  it("shows Part 5 why-now and blocked/safe fact policy on person detail", () => {
    saveDemoRelationship();

    const person = getPersonIntelligenceViewModel(DEMO_CONTACT_ID, DEMO_USER_ID);

    expect(person.recommendation.whyNow[0]).toContain("warm");
    expect(person.recommendation.whatToAvoid.join(" ")).toContain("Do not");
    expect(person.recommendation.safeFacts.length).toBeGreaterThan(0);
    expect(person.recommendation.blockedFacts).toContain("Recursive is expanding across European tech events.");
  });
});
