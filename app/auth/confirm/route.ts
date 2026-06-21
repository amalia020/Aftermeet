import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getAuthCallbackDestination } from "@/lib/auth/callback";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = (requestUrl.searchParams.get("type") ?? "email") as EmailOtpType;
  const requestedNext = requestUrl.searchParams.get("next");
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!tokenHash || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

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

  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.session?.user) {
    return NextResponse.redirect(new URL("/login?error=auth_confirm", requestUrl.origin));
  }

  const { data: objective } = await supabase
    .from("user_objectives")
    .select("id")
    .eq("user_id", data.session.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const destination = getAuthCallbackDestination({
    requestedNext,
    hasSession: true,
    hasObjective: Boolean(objective),
  });
  const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
