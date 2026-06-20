import { describe, expect, it } from "vitest";
import { opportunityPriority } from "../scoring";

const base = {
  userGoalFit: 0.5,
  contactPovFit: 0.5,
  stakes: 0.5,
  urgencyDecay: 0.5,
  explicitCommitment: 0,
  factConfidence: 0.5,
  relationshipStrength: 0.5,
  recipientBurden: 0,
  uncertaintyPenalty: 0,
};

describe("opportunityPriority", () => {
  it("stays within [0,1]", () => {
    const high = opportunityPriority({
      ...base,
      userGoalFit: 1,
      contactPovFit: 1,
      stakes: 1,
      urgencyDecay: 1,
      explicitCommitment: 1,
      factConfidence: 1,
      relationshipStrength: 1,
    });
    expect(high).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThanOrEqual(0);

    const low = opportunityPriority({
      ...base,
      userGoalFit: 0,
      contactPovFit: 0,
      stakes: 0,
      urgencyDecay: 0,
      factConfidence: 0,
      relationshipStrength: 0,
      recipientBurden: 1,
      uncertaintyPenalty: 1,
    });
    expect(low).toBe(0);
  });

  it("rises with user goal fit (responds to objective)", () => {
    const weakGoal = opportunityPriority({ ...base, userGoalFit: 0.1 });
    const strongGoal = opportunityPriority({ ...base, userGoalFit: 0.9 });
    expect(strongGoal).toBeGreaterThan(weakGoal);
  });

  it("explicit commitment raises priority", () => {
    const without = opportunityPriority({ ...base, explicitCommitment: 0 });
    const withCommit = opportunityPriority({ ...base, explicitCommitment: 1 });
    expect(withCommit).toBeGreaterThan(without);
  });

  it("high recipient burden lowers priority", () => {
    const low = opportunityPriority({ ...base, recipientBurden: 0 });
    const high = opportunityPriority({ ...base, recipientBurden: 1 });
    expect(high).toBeLessThan(low);
  });

  it("low fact confidence lowers priority", () => {
    const high = opportunityPriority({ ...base, factConfidence: 1 });
    const low = opportunityPriority({ ...base, factConfidence: 0 });
    expect(low).toBeLessThan(high);
  });
});
