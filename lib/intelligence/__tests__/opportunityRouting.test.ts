import { describe, expect, it } from "vitest";
import { scoreOpportunityRoutes } from "../opportunityRouting";
import { inferUserCluster } from "../userObjective";
import { classifyContactCluster } from "../clustering";
import type {
  Contact,
  ConversationAtoms,
  UserObjectiveProfile,
} from "@/lib/types";

const NOW = new Date("2026-06-20T10:30:00.000Z");

const findUsersObjective: UserObjectiveProfile = {
  id: "obj_1",
  userId: "user_1",
  role: "founder",
  primaryGoal: "find_users",
  secondaryGoals: [],
  activeGoals: ["find_users"],
  attentionBudgetToday: 5,
  preferredTone: "warm",
  constraints: [],
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

function contact(role: string, company = "Acme"): Contact {
  return {
    id: "c1",
    userId: "user_1",
    name: "Test",
    role,
    company,
    sourceType: "manual",
    entityMatchConfidence: 0.8,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

const emptyAtoms: ConversationAtoms = {
  facts: [],
  asks: [],
  offers: [],
  commitments: [],
  uncertainties: [],
  extractionConfidence: 0.7,
};

describe("scoreOpportunityRoutes", () => {
  it("for find_users goal, a potential user outranks an investor", () => {
    const userCluster = inferUserCluster({ objective: findUsersObjective });

    const investorContact = contact("Partner at Sequoia Ventures (VC)");
    const founderContact = contact("Founder / CEO");
    const founderAtoms: ConversationAtoms = {
      ...emptyAtoms,
      offers: [{ text: "Wants to try the product at her next event.", mutualValue: 0.8 }],
    };

    const investorRoutes = scoreOpportunityRoutes({
      userCluster,
      contactCluster: classifyContactCluster({ contact: investorContact, atoms: emptyAtoms }),
      atoms: emptyAtoms,
      facts: [],
      objective: findUsersObjective,
      contactId: "c_inv",
      now: NOW,
    });
    const userRoutes = scoreOpportunityRoutes({
      userCluster,
      contactCluster: classifyContactCluster({ contact: founderContact, atoms: founderAtoms }),
      atoms: founderAtoms,
      facts: [],
      objective: findUsersObjective,
      contactId: "c_user",
      now: NOW,
    });

    const raiseRoute = investorRoutes.find((r) => r.type === "raise")!;
    const userRoute = userRoutes.find((r) => r.type === "user")!;

    // Under a find_users goal, the user route for a potential user should beat
    // the raise route for an investor.
    expect(userRoute.score).toBeGreaterThan(raiseRoute.score);
  });

  it("returns multiple routes and attaches why/whyNot", () => {
    const userCluster = inferUserCluster({ objective: findUsersObjective });
    const routes = scoreOpportunityRoutes({
      userCluster,
      contactCluster: classifyContactCluster({ contact: contact("Founder"), atoms: emptyAtoms }),
      atoms: emptyAtoms,
      facts: [],
      objective: findUsersObjective,
      contactId: "c1",
      now: NOW,
    });
    expect(routes.length).toBeGreaterThan(1);
    // Routes are sorted descending by score.
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i - 1].score).toBeGreaterThanOrEqual(routes[i].score);
    }
    // The raise route for a non-investor should carry a why-not.
    const raise = routes.find((r) => r.type === "raise")!;
    expect(raise.whyNot.length).toBeGreaterThan(0);
  });
});
