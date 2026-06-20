import { describe, expect, it } from "vitest";
import { recipientBurden } from "../recipientBurden";

describe("recipientBurden", () => {
  it("generic coffee ask with weak relationship yields high burden", () => {
    const burden = recipientBurden({
      messageSpecificity: 0.1, // generic
      askSize: 0.8, // wants their time
      relationshipStrength: 0.1, // barely know them
      mutualValue: 0.1, // one-sided
      timingFit: 0.2,
    });
    expect(burden).toBeGreaterThan(0.7);
  });

  it("specific, mutual-value follow-up yields low burden", () => {
    const burden = recipientBurden({
      messageSpecificity: 0.95,
      askSize: 0.15,
      relationshipStrength: 0.8,
      mutualValue: 0.9,
      timingFit: 0.9,
    });
    expect(burden).toBeLessThan(0.3);
  });

  it("is monotonic in genericness", () => {
    const specific = recipientBurden({
      messageSpecificity: 0.9,
      askSize: 0.4,
      relationshipStrength: 0.5,
      mutualValue: 0.5,
      timingFit: 0.5,
    });
    const generic = recipientBurden({
      messageSpecificity: 0.1,
      askSize: 0.4,
      relationshipStrength: 0.5,
      mutualValue: 0.5,
      timingFit: 0.5,
    });
    expect(generic).toBeGreaterThan(specific);
  });

  it("clamps to [0,1]", () => {
    const burden = recipientBurden({
      messageSpecificity: 0,
      askSize: 1,
      relationshipStrength: 0,
      mutualValue: 0,
      timingFit: 0,
    });
    expect(burden).toBeLessThanOrEqual(1);
    expect(burden).toBeGreaterThanOrEqual(0);
  });
});
