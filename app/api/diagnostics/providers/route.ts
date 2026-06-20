/**
 * Provider diagnostics (dev/test). Actually CALLS each external provider with a
 * tiny probe and reports whether the LIVE API answered (`mode: "live"`) or the
 * code fell back to fixtures (`mode: "fallback"`), plus any error.
 *
 * This is how you confirm an API is really working:
 *   - configured=false        -> no key in .env.local
 *   - mode="fallback" + error -> key present but the live call failed (see error)
 *   - mode="live"             -> the real API answered  ✅
 *
 * Run:  curl -s http://localhost:3000/api/diagnostics/providers | jq
 */

import { NextResponse } from "next/server";
import { providerAvailability } from "@/lib/config";
import { claudeComplete } from "@/lib/providers/claude";
import { calaKnowledgeSearch } from "@/lib/providers/cala";
import { geminiWebContext } from "@/lib/providers/gemini";
import { getPaymentLink } from "@/lib/providers/mollie";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ProbeResult {
  provider: string;
  configured: boolean;
  mode: "live" | "fallback" | "skipped";
  ok: boolean;
  detail: string;
  warnings?: string[];
  sample?: unknown;
}

export async function GET() {
  const results: ProbeResult[] = [];

  // --- Claude ---
  {
    const out = await claudeComplete({
      system: "You are a connectivity probe. Reply with strict JSON only.",
      user: 'Return exactly this JSON: {"pong":true}',
      maxTokens: 50,
      timeoutMs: 15000,
    });
    const live = out.mode === "live";
    results.push({
      provider: "claude",
      configured: providerAvailability.claude,
      mode: out.mode,
      ok: live,
      detail: live
        ? "Anthropic API responded"
        : providerAvailability.claude
          ? "Key present but live call failed"
          : "No ANTHROPIC_API_KEY",
      warnings: out.warnings,
      sample: live ? out.data.slice(0, 120) : undefined,
    });
  }

  // --- Cala (NOTE: endpoint/shape is best-effort until confirmed against docs) ---
  {
    const res = await calaKnowledgeSearch("Recursive applied AI company");
    results.push({
      provider: "cala",
      configured: providerAvailability.cala,
      mode: res.available ? "live" : "fallback",
      ok: res.available,
      detail: res.available
        ? `Cala returned ${res.candidates.length} candidate(s)`
        : providerAvailability.cala
          ? "Key present but live call failed (check CALA_API_URL + payload shape vs docs)"
          : "No CALA_API_KEY",
      warnings: res.warnings,
      sample: res.available ? res.candidates.slice(0, 2) : undefined,
    });
  }

  // --- Gemini grounded web ---
  {
    const res = await geminiWebContext({
      company: "Anthropic",
      query: "What does Anthropic do? One sentence with a source.",
    });
    // available can be true from the fixture too, so cross-check the key.
    const live = res.available && providerAvailability.gemini;
    results.push({
      provider: "gemini",
      configured: providerAvailability.gemini,
      mode: live ? "live" : "fallback",
      ok: live,
      detail: live
        ? `Gemini returned ${res.claims.length} cited claim(s)`
        : providerAvailability.gemini
          ? "Key present but live call failed or returned no cited claims"
          : "No GEMINI_API_KEY (fixture returned)",
      sample: live ? res.claims.slice(0, 2) : undefined,
    });
  }

  // --- Whisper (cannot probe without audio) ---
  results.push({
    provider: "whisper",
    configured: providerAvailability.whisper,
    mode: "skipped",
    ok: providerAvailability.whisper,
    detail: providerAvailability.whisper
      ? "OPENAI_API_KEY present — cannot auto-probe without an audio file; test via /api/capture/voice"
      : "No OPENAI_API_KEY",
  });

  // --- Mollie (config-only) ---
  {
    const link = getPaymentLink();
    results.push({
      provider: "mollie",
      configured: providerAvailability.mollie,
      mode: link.demo ? "fallback" : "live",
      ok: !link.demo,
      detail: link.demo
        ? "Using demo payment link (set MOLLIE_PAYMENT_LINK)"
        : "Configured payment link present",
      sample: link.url,
    });
  }

  const liveCount = results.filter((r) => r.mode === "live").length;
  return NextResponse.json({
    summary: {
      live: liveCount,
      total: results.length,
      allConfiguredLive: results
        .filter((r) => r.configured && r.provider !== "whisper")
        .every((r) => r.ok),
    },
    results,
    timestamp: new Date().toISOString(),
  });
}
