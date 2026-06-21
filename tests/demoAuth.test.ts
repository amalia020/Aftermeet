import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMagicLinkErrorMessage, isDemoPasscodeConfigured, isDemoPasscodeValid } from "@/lib/auth/demo";

const authState = vi.hoisted(() => ({
  existingUser: null as { id: string } | null,
  signInUser: { id: "anon_user" } as { id: string } | null,
  signInError: null as { message: string } | null,
  objective: null as { id: string } | null,
  cookiesToSet: [{ name: "sb-test-auth-token", value: "token", options: { path: "/" } }],
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: { setAll: (cookies: typeof authState.cookiesToSet) => void } }) => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authState.existingUser }, error: null })),
      signInAnonymously: vi.fn(async () => {
        if (authState.signInError) return { data: { user: null }, error: authState.signInError };
        options.cookies.setAll(authState.cookiesToSet);
        return { data: { user: authState.signInUser }, error: null };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: authState.objective, error: null })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe("demo auth", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.AFTERMEET_DEMO_PASSCODE = "demo-pass";
    authState.existingUser = null;
    authState.signInUser = { id: "anon_user" };
    authState.signInError = null;
    authState.objective = null;
  });

  it("requires a configured passcode and exact submitted value", () => {
    expect(isDemoPasscodeConfigured()).toBe(true);
    expect(isDemoPasscodeValid("demo-pass")).toBe(true);
    expect(isDemoPasscodeValid("wrong")).toBe(false);
    expect(isDemoPasscodeValid(" demo-pass ")).toBe(false);

    delete process.env.AFTERMEET_DEMO_PASSCODE;
    expect(isDemoPasscodeConfigured()).toBe(false);
    expect(isDemoPasscodeValid("demo-pass")).toBe(false);
  });

  it("turns Supabase email rate limits into demo-first copy", () => {
    expect(getMagicLinkErrorMessage("Email rate limit exceeded")).toBe(
      "Email login is cooling down. Use demo access now, or try magic link again later.",
    );
    expect(getMagicLinkErrorMessage("Invalid email")).toBe("Invalid email");
  });

  it("rejects wrong passcodes before touching Supabase", async () => {
    const { POST } = await import("@/app/api/auth/demo/route");
    const response = await POST(new Request("http://test/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ passcode: "wrong" }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "DEMO_PASSCODE_INVALID",
      message: "Demo passcode is invalid.",
    });
  });

  it("creates an anonymous session and routes first-run users to setup", async () => {
    const { POST } = await import("@/app/api/auth/demo/route");
    const response = await POST(new Request("http://test/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ passcode: "demo-pass" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ destination: "/setup" });
    expect(response.headers.get("set-cookie")).toContain("sb-test-auth-token=token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("routes demo users with setup to today", async () => {
    authState.objective = { id: "obj_1" };
    const { POST } = await import("@/app/api/auth/demo/route");
    const response = await POST(new Request("http://test/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ passcode: "demo-pass" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ destination: "/today" });
  });
});
