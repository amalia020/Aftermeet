import { describe, expect, it } from "vitest";
import { actionForOpportunity, chooseAction } from "../actionPolicy";
import type { OpportunityRoute } from "@/lib/types";

function route(type: OpportunityRoute["type"]): OpportunityRoute {
  return { type, score: 0.8, evidence: [], why: [], whyNot: [] };
}

const base = {
  status: "new" as const,
  entityMatchConfidence: 0.9,
  recipientBurden: 0.2,
  priorityScore: 0.8,
  urgencyScore: 0.5,
  topOpportunityRoute: route("user"),
  hasExplicitCommitment: true,
};

describe("chooseAction", () => {
  it("low entity match -> CONFIRM_DETAILS", () => {
    expect(chooseAction({ ...base, entityMatchConfidence: 0.3 })).toBe(
      "CONFIRM_DETAILS",
    );
  });

  it("high burden -> DO_NOT_CONTACT", () => {
    expect(chooseAction({ ...base, recipientBurden: 0.8 })).toBe("DO_NOT_CONTACT");
  });

  it("new + high priority -> action for top route (user => SEND_EARLY_ACCESS)", () => {
    expect(chooseAction({ ...base })).toBe("SEND_EARLY_ACCESS");
  });

  it("drafted + priority>0.55 -> SEND_DRAFT", () => {
    expect(
      chooseAction({ ...base, status: "drafted", priorityScore: 0.6 }),
    ).toBe("SEND_DRAFT");
  });

  it("sent + urgency>0.70 -> SEND_NUDGE", () => {
    expect(
      chooseAction({ ...base, status: "sent", priorityScore: 0.5, urgencyScore: 0.8 }),
    ).toBe("SEND_NUDGE");
  });

  it("reply status -> REPLY_NOW", () => {
    expect(
      chooseAction({ ...base, status: "reply", priorityScore: 0.5 }),
    ).toBe("REPLY_NOW");
  });

  it("low priority -> STAY_CALM (no action)", () => {
    expect(
      chooseAction({ ...base, status: "new", priorityScore: 0.2 }),
    ).toBe("STAY_CALM");
  });

  it("medium priority falls through to WAIT", () => {
    expect(
      chooseAction({ ...base, status: "new", priorityScore: 0.5 }),
    ).toBe("WAIT");
  });
});

describe("actionForOpportunity", () => {
  it("maps route types to opening actions", () => {
    expect(actionForOpportunity(route("user"))).toBe("SEND_EARLY_ACCESS");
    expect(actionForOpportunity(route("raise"))).toBe("SEND_DECK");
    expect(actionForOpportunity(route("partner"))).toBe("PROPOSE_PILOT");
    expect(actionForOpportunity(route("mentor"))).toBe("ASK_SHARP_QUESTION");
  });
});
