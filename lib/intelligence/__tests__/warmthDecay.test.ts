import { describe, expect, it } from "vitest";
import { HALF_LIFE_HOURS, warmthScore } from "../warmthDecay";

describe("warmthScore", () => {
  it("booked never flags (returns 0)", () => {
    expect(
      warmthScore({ opportunityType: "user", hoursSinceLastAction: 0, status: "booked" }),
    ).toBe(0);
    expect(
      warmthScore({ opportunityType: "raise", hoursSinceLastAction: 200, status: "booked" }),
    ).toBe(0);
  });

  it("reply status is more urgent than new at the same time", () => {
    const args = { opportunityType: "user" as const, hoursSinceLastAction: 24 };
    const reply = warmthScore({ ...args, status: "reply" });
    const fresh = warmthScore({ ...args, status: "new" });
    expect(reply).toBeGreaterThan(fresh);
  });

  it("drafted is boosted over new", () => {
    const args = { opportunityType: "user" as const, hoursSinceLastAction: 24 };
    expect(warmthScore({ ...args, status: "drafted" })).toBeGreaterThan(
      warmthScore({ ...args, status: "new" }),
    );
  });

  it("warmth decays with time", () => {
    const args = { opportunityType: "raise" as const, status: "new" as const };
    const fresh = warmthScore({ ...args, hoursSinceLastAction: 0 });
    const old = warmthScore({ ...args, hoursSinceLastAction: 200 });
    expect(fresh).toBeGreaterThan(old);
    expect(fresh).toBeCloseTo(1, 5);
  });

  it("uses opportunity-type half-life (raise decays faster than mentor)", () => {
    const hours = HALF_LIFE_HOURS.raise; // one raise time-constant
    const raise = warmthScore({ opportunityType: "raise", hoursSinceLastAction: hours, status: "new" });
    const mentor = warmthScore({ opportunityType: "mentor", hoursSinceLastAction: hours, status: "new" });
    // Spec formula is exp(-hours/halfLife): at one time-constant => e^-1 ≈ 0.368.
    expect(raise).toBeCloseTo(Math.exp(-1), 5);
    expect(mentor).toBeGreaterThan(raise);
  });

  it("clamps to [0,1]", () => {
    const reply = warmthScore({ opportunityType: "user", hoursSinceLastAction: 0, status: "reply" });
    expect(reply).toBeLessThanOrEqual(1);
    expect(reply).toBeGreaterThanOrEqual(0);
  });
});
