import { describe, expect, it } from "vitest";
import "./helpers";
import { DEMO_CONTACT_ID, DEMO_CONVERSATION_ID, DEMO_USER_ID, demoExtractionResult, part2DemoEvidenceBundle, part3DemoRecommendationPackage } from "@/lib/demo/fixtures";
import { saveConversationAtoms, saveEvidenceBundle, saveRecommendation, upsertContact } from "@/lib/db/queries";
import { getDailyBriefViewModel } from "@/lib/frontend/viewModels";
import { getPostLoginDestination } from "@/lib/frontend/onboarding";

const generatedAt = "2026-06-20T10:30:00.000Z";

function saveActionableRecommendation(status = part3DemoRecommendationPackage.recommendation.status) {
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
  });
  saveConversationAtoms({
    conversationId: DEMO_CONVERSATION_ID,
    atoms: demoExtractionResult.atoms,
  });
  saveEvidenceBundle(part2DemoEvidenceBundle);
  saveRecommendation({
    ...part3DemoRecommendationPackage.recommendation,
    userId: DEMO_USER_ID,
    contactId: DEMO_CONTACT_ID,
    conversationId: DEMO_CONVERSATION_ID,
    status,
  });
}

describe("production onboarding and brief flow", () => {
  it("routes authenticated users without a mission to setup before Today", () => {
    expect(getPostLoginDestination({ hasSession: true, hasObjective: false })).toBe("/setup");
    expect(getPostLoginDestination({ hasSession: true, hasObjective: true })).toBe("/");
    expect(getPostLoginDestination({ hasSession: false, hasObjective: false })).toBe("/login");
  });

  it("does not show demo brief cards when live mode has no recommendations", () => {
    process.env.AFTERMEET_DEMO_MODE = "false";

    const brief = getDailyBriefViewModel("new_live_user");

    expect(brief.moves).toEqual([]);
    expect(brief.headline).toBe("No relationship moves yet");
  });

  it("removes sent recommendations from Today", () => {
    saveActionableRecommendation("sent");

    const brief = getDailyBriefViewModel(DEMO_USER_ID);

    expect(brief.moves).toEqual([]);
    expect(brief.proof.find((item) => item.label === "Today")?.value).toBe("0");
  });
});
