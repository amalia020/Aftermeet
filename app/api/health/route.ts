import { NextResponse } from "next/server";
import { runtimeConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "aftermeet",
    demoMode: runtimeConfig.demoMode,
    auth: runtimeConfig.providerAvailability.supabase ? "supabase" : "demo",
    storage: "local-json",
    supabaseSchema: "supabase/schema.sql",
    providers: runtimeConfig.providerAvailability,
    timestamp: new Date().toISOString(),
  });
}
