/**
 * Phase 5b — Gemini grounded web fallback (server-only).
 *
 * FALLBACK ONLY. The enrichment coordinator calls this exclusively after Cala
 * has no / low match, and only for contacts the user actually met. Uses the
 * Gemini API with the Google Search grounding tool so the model answers from
 * live web results and returns citation URLs.
 *
 * Hard rules enforced here:
 *  - Every claim must carry a sourceUrl; uncited claims are discarded.
 *  - Professional/public context only; the prompt forbids personal/sensitive data.
 *  - Never throws; missing key / failure / ambiguous results -> fixture or
 *    available:false.
 */

import "server-only";
import { runtimeConfig, shouldRunLive } from "@/lib/config";
import { part2DemoWebResult } from "@/lib/demo/savedExamples";
import type { WebContextClaim, WebContextResult } from "@/lib/types";
import { sourceTypeFromDomain } from "@/lib/intelligence/sourceConfidence";
import {
  fallbackOutcome,
  liveOutcome,
  safeJsonParse,
  withTimeout,
  type ProviderOutcome,
} from "./runtime";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM_PROMPT =
  "You retrieve public, professional context about a person or company the user met at an event. Use only the grounded web results. Return concise professional facts, each with its source URL. Do not include personal, sensitive, or non-professional information. Do not guess. If the results do not clearly match the person/company, return available=false. Return JSON only.";

function buildUserPrompt(input: {
  name?: string;
  company?: string;
  role?: string;
  query: string;
}): string {
  const subject = `${input.name ?? "Unknown"} — ${input.role ?? "unknown role"} at ${input.company ?? "unknown company"}`;
  return [
    "Person/company:",
    subject,
    "",
    "Question:",
    input.query,
    "",
    "Return JSON only with this shape:",
    '{ "summary": string, "available": boolean, "claims": [ { "text": string, "sourceUrl": string } ] }',
  ].join("\n");
}

interface RawWebResult {
  summary?: string;
  available?: boolean;
  claims?: { text?: string; sourceUrl?: string }[];
}

/**
 * Normalize a parsed model result into a WebContextResult, discarding any claim
 * that lacks a citation URL and inferring sourceType from the cited domain.
 */
function normalize(
  raw: RawWebResult,
  retrievedAt: string,
): { result: WebContextResult; warnings: string[] } {
  const warnings: string[] = [];
  const claims: WebContextClaim[] = [];

  for (const c of raw.claims ?? []) {
    const text = (c.text ?? "").trim();
    const url = (c.sourceUrl ?? "").trim();
    if (!text) continue;
    if (!url) {
      warnings.push("SOURCE_REQUIRED: discarded uncited claim");
      continue;
    }
    claims.push({ text, sourceUrl: url, sourceType: sourceTypeFromDomain(url) });
  }

  const available = raw.available !== false && claims.length > 0;
  return {
    result: {
      summary: raw.summary ?? "",
      claims,
      retrievedAt,
      available,
    },
    warnings,
  };
}

export async function geminiWebContext(input: {
  name?: string;
  company?: string;
  role?: string;
  query: string;
  now?: Date;
}): Promise<WebContextResult> {
  const retrievedAt = (input.now ?? new Date()).toISOString();

  const fallback = (): ProviderOutcome<WebContextResult> =>
    fallbackOutcome(
      { ...part2DemoWebResult, retrievedAt },
      ["gemini: web fallback fixture"],
    );

  if (!shouldRunLive("gemini")) {
    return fallback().data;
  }

  const outcome = await withTimeout<WebContextResult>(
    "gemini.web",
    runtimeConfig.timeouts.webMs,
    async (signal) => {
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${runtimeConfig.keys.geminiKey as string}`;
      const response = await fetch(url, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
          // Google Search grounding tool.
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      const json = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          groundingMetadata?: {
            groundingChunks?: { web?: { uri?: string } }[];
          };
        }[];
      };

      const candidate = json.candidates?.[0];
      const text =
        candidate?.content?.parts?.map((p) => p.text ?? "").join("\n").trim() ??
        "";
      const parsed = safeJsonParse<RawWebResult>(text);
      if (!parsed) throw new Error("unparseable Gemini response");

      // Backfill missing claim URLs from grounding metadata where possible.
      const groundingUris =
        candidate?.groundingMetadata?.groundingChunks
          ?.map((g) => g.web?.uri)
          .filter((u): u is string => Boolean(u)) ?? [];
      if (parsed.claims) {
        parsed.claims = parsed.claims.map((c, i) => ({
          ...c,
          sourceUrl: c.sourceUrl || groundingUris[i] || "",
        }));
      }

      const { result, warnings } = normalize(parsed, retrievedAt);
      return liveOutcome(result, warnings);
    },
    fallback,
  );

  return outcome.data;
}
