/**
 * Central runtime configuration. Server-only secrets are read here and nowhere
 * else in app code. Frontend never imports this.
 *
 * Demo mode (Phase 25): the app must run end-to-end with zero keys. When a key
 * is missing the relevant provider falls back to fixtures and is labelled
 * "Demo data" in the UI. AFTERMEET_DEMO_MODE can force demo mode globally.
 */

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

const calaKey = env("CALA_API_KEY");
const geminiKey = env("GEMINI_API_KEY");
const openaiKey = env("OPENAI_API_KEY");
const molliePaymentLink = env("MOLLIE_PAYMENT_LINK");
const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL") ?? env("SUPABASE_URL");
const supabaseAnonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const forcedDemo = env("AFTERMEET_DEMO_MODE");
const forceDemoMode = forcedDemo === "true";
const forceLiveMode = forcedDemo === "false";

export const providerAvailability = {
  supabase: Boolean(supabaseUrl && supabaseAnonKey),
  cala: Boolean(calaKey),
  gemini: Boolean(geminiKey),
  whisper: Boolean(openaiKey),
  openai: Boolean(openaiKey),
  mollie: Boolean(molliePaymentLink),
} as const;

/**
 * Global demo mode: true when explicitly forced, or when no LLM key exists at
 * all (so nothing live can run). Individual providers still fall back per-call.
 */
const demoMode =
  forceDemoMode ||
  (!forceLiveMode && !providerAvailability.gemini && !providerAvailability.openai);

export const runtimeConfig = {
  demoMode,
  forceDemoMode,
  forceLiveMode,
  providerAvailability,
  keys: {
    calaKey,
    geminiKey,
    openaiKey,
    molliePaymentLink,
  },
  models: {
    gemini: env("GEMINI_MODEL") ?? "gemini-flash-latest",
    openaiChat: env("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini",
    openaiTranscribe: env("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-transcribe",
  },
  timeouts: {
    extractionMs: 20000,
    calaMs: 12000,
    webMs: 15000,
    draftMs: 20000,
    transcribeMs: 30000,
  },
} as const;

/** Should a given provider attempt a live call? */
export function shouldRunLive(
  provider: keyof typeof providerAvailability,
): boolean {
  if (runtimeConfig.forceDemoMode) return false;
  return providerAvailability[provider];
}
