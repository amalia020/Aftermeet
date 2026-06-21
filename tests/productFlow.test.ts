import { describe, expect, it } from "vitest";
import "./helpers";
import { DEMO_CONTACT_ID, DEMO_CONVERSATION_ID, DEMO_USER_ID, demoExtractionResult, part2DemoEvidenceBundle, part3DemoRecommendationPackage } from "@/lib/demo/fixtures";
import { saveConversationAtoms, saveEvidenceBundle, saveRecommendation, upsertContact } from "@/lib/db/queries";
import { getDailyBriefViewModel, getNavigationItems } from "@/lib/frontend/viewModels";
import { getLoginRedirectDestination, getPostLoginDestination, getRootDestination } from "@/lib/frontend/onboarding";
import { shouldUseSupabaseDatabase } from "@/lib/db/runtime";

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
  it("always sends root traffic to login first", () => {
    expect(getRootDestination()).toBe("/login");
  });

  it("routes login sessions by setup state", () => {
    expect(getLoginRedirectDestination({ hasSession: false, hasObjective: false })).toBeNull();
    expect(getLoginRedirectDestination({ hasSession: true, hasObjective: false })).toBe("/setup");
    expect(getLoginRedirectDestination({ hasSession: true, hasObjective: true })).toBe("/today");
  });

  it("routes authenticated users without a mission to setup before Today", () => {
    expect(getPostLoginDestination({ hasSession: true, hasObjective: false })).toBe("/setup");
    expect(getPostLoginDestination({ hasSession: true, hasObjective: true })).toBe("/today");
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

  it("shows at most three pending Today moves", () => {
    saveActionableRecommendation("pending");
    for (let index = 0; index < 4; index += 1) {
      const contactId = `contact_extra_${index}`;
      upsertContact({
        id: contactId,
        userId: DEMO_USER_ID,
        name: `Extra ${index}`,
        role: "Founder",
        company: "Studio",
        email: null,
        phone: null,
        website: null,
        linkedinUrl: null,
        sourceType: "manual",
        entityMatchConfidence: 0.74,
        createdAt: generatedAt,
        updatedAt: generatedAt,
      });
      saveRecommendation({
        ...part3DemoRecommendationPackage.recommendation,
        id: `rec_extra_${index}`,
        userId: DEMO_USER_ID,
        contactId,
        conversationId: DEMO_CONVERSATION_ID,
        status: "pending",
      });
    }

    const brief = getDailyBriefViewModel(DEMO_USER_ID);

    expect(brief.moves).toHaveLength(3);
  });

  it("keeps Radar in primary navigation", () => {
    expect(getNavigationItems().map((item) => item.label)).toEqual([
      "Today",
      "Radar",
      "Capture",
      "People",
      "Progress",
    ]);
  });

  it("uses Supabase DB only when public Supabase env is configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect(shouldUseSupabaseDatabase()).toBe(true);

    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(shouldUseSupabaseDatabase()).toBe(false);
  });
});
