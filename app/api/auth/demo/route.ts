import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPostLoginDestination } from "@/lib/frontend/onboarding";
import { isDemoPasscodeValid } from "@/lib/auth/demo";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

async function readPasscode(request: Request): Promise<string> {
  try {
    const body = await request.json() as { passcode?: unknown };
    return typeof body.passcode === "string" ? body.passcode : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const passcode = await readPasscode(request);
  if (!isDemoPasscodeValid(passcode)) {
    return NextResponse.json(
      { error: "DEMO_PASSCODE_INVALID", message: "Demo passcode is invalid." },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "SUPABASE_NOT_CONFIGURED", message: "Supabase env is missing." },
      { status: 503 },
    );
  }

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split(";")
          .map((cookie) => {
            const [name, ...value] = cookie.trim().split("=");
            return { name, value: value.join("=") };
          }) ?? [];
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const existing = await supabase.auth.getUser();
  const user = existing.data.user ?? (await supabase.auth.signInAnonymously()).data.user;
  if (!user) {
    return NextResponse.json(
      {
        error: "DEMO_AUTH_UNAVAILABLE",
        message: "Demo access is not enabled. Enable Anonymous Sign-Ins in Supabase Auth.",
      },
      { status: 503 },
    );
  }

  const { data: objective } = await supabase
    .from("user_objectives")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const response = NextResponse.json({
    destination: getPostLoginDestination({
      hasSession: true,
      hasObjective: Boolean(objective),
    }),
  });
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
