import type { JsonValue, WebContextClaim, WebContextResult } from "@/lib/types";
import { getServerEnv } from "@/lib/env";
import { demoWebContext } from "@/lib/demo/fixtures";
import { inferSourceTypeFromUrl } from "@/lib/intelligence/utils";

function extractJson(text: string): JsonValue | undefined {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    return JSON.parse(candidate) as JsonValue;
  } catch {
    return undefined;
  }
}

function parseGeminiJson(text: string): WebContextResult | null {
  const parsedJson = extractJson(text);
  if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
    return null;
  }
  try {
    const parsed = parsedJson as Partial<WebContextResult>;
    const rawClaims = Array.isArray(parsed.claims) ? (parsed.claims as unknown[]) : [];
    // Claims may arrive as plain strings or as { text, sourceUrl, sourceType }.
    const claims: WebContextClaim[] = rawClaims
          .map((claim): WebContextClaim | null => {
            if (typeof claim === "string") {
              return { text: claim, sourceUrl: "", sourceType: inferSourceTypeFromUrl("") };
            }
            if (claim && typeof claim === "object" && "text" in claim) {
              const record = claim as Record<string, unknown>;
              if (typeof record.text !== "string") return null;
              const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl : "";
              return {
                text: record.text,
                sourceUrl,
                sourceType:
                  typeof record.sourceType === "string"
                    ? (record.sourceType as WebContextClaim["sourceType"])
                    : inferSourceTypeFromUrl(sourceUrl)
              };
            }
            return null;
          })
          .filter((claim): claim is WebContextClaim => claim !== null);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      claims,
      retrievedAt:
        typeof parsed.retrievedAt === "string" ? parsed.retrievedAt : new Date().toISOString(),
      available: Boolean(parsed.available)
    };
  } catch {
    return null;
  }
}

interface GeminiGroundingMetadata {
  groundingChunks?: Array<{
    web?: { uri?: string; title?: string };
  }>;
  groundingSupports?: Array<{
    segment?: { text?: string; startIndex?: number; endIndex?: number };
    groundingChunkIndices?: number[];
  }>;
  webSearchQueries?: string[];
}

interface GeminiGroundedCandidate {
  content?: { parts?: { text?: string }[] };
  groundingMetadata?: GeminiGroundingMetadata;
}

/**
 * Strip JSON scaffolding, citation markers and stray quotes out of a grounded
 * text fragment. The grounded model sometimes returns its whole JSON payload as
 * prose, and grounding segments then point at raw substrings of that JSON — this
 * keeps a single clean sentence instead of a blob like
 * `…intelligence.", "claims": [ "Amalia…`.
 */
function cleanGroundedText(raw: string): string {
  let text = (raw ?? "").trim();
  // Drop a leading JSON key wrapper, e.g.  {"summary": "  or  "text": "
  text = text.replace(/^[\s[\]{},]*"?(?:text|fact|summary|claims)"?\s*:\s*\[?\s*"?/i, "");
  // If JSON leaked in, cut at the first structural break into another field/array.
  const breakAt = text.search(
    /"\s*,\s*"(?:claims|summary|sourceurl|sourcetype|available|text|fact)"|"\s*:\s*\[/i
  );
  if (breakAt !== -1) text = text.slice(0, breakAt);
  // Remove inline citation markers like [2.1.2] or [3].
  text = text.replace(/\s*\[\d+(?:\.\d+)*\]/g, "");
  // Trim stray wrapping quotes / trailing JSON punctuation.
  return text.replace(/^["'\s]+/, "").replace(/["'\s,}\]]+$/, "").trim();
}

export function parseGroundedGeminiCandidate(
  candidate: GeminiGroundedCandidate,
  retrievedAt = new Date().toISOString()
): WebContextResult | null {
  const text = candidate.content?.parts?.find((part) => part.text)?.text ?? "";
  const parsed = parseGeminiJson(text);
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const supports = candidate.groundingMetadata?.groundingSupports ?? [];

  // Ordered, de-duplicated citation URLs from grounding metadata.
  const groundingUrls: string[] = [];
  for (const support of supports) {
    for (const index of support.groundingChunkIndices ?? []) {
      const url = chunks[index]?.web?.uri;
      if (url && !groundingUrls.includes(url)) groundingUrls.push(url);
    }
  }

  let claims: WebContextClaim[];
  if (parsed?.claims.length) {
    // Prefer the model's structured claims — one clean fact each. Attach a
    // citation positionally when the claim didn't carry its own.
    claims = parsed.claims
      .map((claim, index): WebContextClaim | null => {
        const cleaned = cleanGroundedText(claim.text);
        if (cleaned.length < 4) return null;
        const sourceUrl = claim.sourceUrl || groundingUrls[index] || "";
        return {
          text: cleaned,
          sourceUrl,
          sourceType: sourceUrl ? inferSourceTypeFromUrl(sourceUrl) : claim.sourceType
        };
      })
      .filter((claim): claim is WebContextClaim => claim !== null);
  } else {
    // No structured JSON — fall back to grounding segments, cleaned of any JSON.
    claims = [];
    for (const support of supports) {
      const cleaned = cleanGroundedText(support.segment?.text ?? "");
      if (cleaned.length < 12) continue;
      const index = support.groundingChunkIndices?.[0];
      const sourceUrl = (index !== undefined && chunks[index]?.web?.uri) || "";
      claims.push({ text: cleaned, sourceUrl, sourceType: inferSourceTypeFromUrl(sourceUrl) });
    }
  }

  // De-duplicate by text.
  const seen = new Set<string>();
  claims = claims.filter((claim) => {
    const key = claim.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = cleanGroundedText(parsed?.summary ?? "") || cleanGroundedText(text);
  if (!summary && !claims.length) return null;

  return {
    summary,
    claims,
    retrievedAt: parsed?.retrievedAt ?? retrievedAt,
    available: claims.length > 0
  };
}

export interface GeminiJsonRequest {
  system: string;
  user: string;
  requestId?: string;
  timeoutMs?: number;
}

export interface GeminiJsonResponse {
  provider: "gemini" | "fixture";
  model?: string;
  json?: JsonValue;
  rawText?: string;
  warnings: string[];
}

export async function requestGeminiJson(input: GeminiJsonRequest): Promise<GeminiJsonResponse> {
  const env = getServerEnv();
  if (!env.geminiApiKey) {
    return {
      provider: "fixture",
      model: "aftermeet-demo-extraction",
      warnings: ["GEMINI_API_KEY is not set; using fixture extraction."]
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.user }] }],
          generationConfig: { temperature: 0, response_mime_type: "application/json" }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      return {
        provider: "fixture",
        model: env.geminiModel,
        warnings: [`Gemini extraction failed with status ${response.status}; using fixture extraction.`]
      };
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      modelVersion?: string;
    };
    const rawText = body.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "";
    return {
      provider: "gemini",
      model: body.modelVersion ?? env.geminiModel,
      json: rawText ? extractJson(rawText) : undefined,
      rawText,
      warnings: rawText ? [] : ["Gemini returned no text content."]
    };
  } catch (error) {
    return {
      provider: "fixture",
      model: env.geminiModel,
      warnings: [
        error instanceof Error
          ? `Gemini extraction failed: ${error.message}; using fixture extraction.`
          : "Gemini extraction failed; using fixture extraction."
      ]
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function geminiWebContext(input: {
  name?: string;
  company?: string;
  role?: string;
  query: string;
  now?: Date;
  timeoutMs?: number;
}): Promise<WebContextResult> {
  const env = getServerEnv();
  const searchSubject = `${input.name ?? ""} ${input.company ?? ""} ${input.query}`.toLowerCase();

  if (!env.geminiApiKey) {
    return searchSubject.includes("recursive")
      ? demoWebContext
      : {
          summary: "",
          claims: [],
          retrievedAt: new Date().toISOString(),
          available: false,
          warnings: ["GEMINI_API_KEY is not configured."]
        };
  }

  const prompt = [
    "Build a concise public professional profile about a person the user met at an event.",
    "Search for current roles, companies, education, technical expertise, public projects, and professional achievements.",
    "Use only grounded web results. Include only facts clearly attributable to the named person.",
    "Do not include personal, sensitive, or non-professional information. Do not guess.",
    "If identity is ambiguous, say so. Return JSON only.",
    "",
    `Person/company: ${input.name ?? "Unknown"} - ${input.role ?? "Unknown role"} at ${
      input.company ?? "Unknown company"
    }`,
    `Question: ${input.query}`,
    "Return: summary, claims (text), available. Citation URLs are supplied separately by Google Search grounding."
  ].join("\n");

  const modelCandidates = Array.from(
    new Set([env.geminiModel, "gemini-flash-latest", "gemini-2.5-flash"])
  );
  const attemptWarnings: string[] = [];
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (const model of modelCandidates) {
      const useGoogleSearchTool = /2\.5|latest/i.test(model);
      const tools = useGoogleSearchTool ? [{ google_search: {} }] : [{ google_search_retrieval: {} }];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools,
            generationConfig: { temperature: 0 }
          }),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        const errorSnippet = errorText.slice(0, 120).replace(/\s+/g, " ");
        attemptWarnings.push(
          `Gemini model ${model} failed with status ${response.status}${
            errorSnippet ? `: ${errorSnippet}` : "."
          }`
        );
        continue;
      }

      const body = (await response.json()) as { candidates?: GeminiGroundedCandidate[] };
      const parsed = body.candidates?.[0]
        ? parseGroundedGeminiCandidate(body.candidates[0])
        : null;
      if (!parsed) {
        attemptWarnings.push(
          `Gemini model ${model} returned no parseable text or grounded citations.`
        );
        continue;
      }
      if (!parsed.claims.length) {
        attemptWarnings.push(
          `Gemini model ${model} returned content without grounded citation metadata.`
        );
        continue;
      }
      return {
        ...parsed,
        model,
        warnings: attemptWarnings
      };
    }

    return {
      summary: "",
      claims: [],
      retrievedAt: new Date().toISOString(),
      available: false,
      warnings: attemptWarnings.length
        ? attemptWarnings
        : ["Gemini web fallback returned no usable model response."]
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      summary: "",
      claims: [],
      retrievedAt: new Date().toISOString(),
      available: false,
      warnings: [
        timedOut
          ? `Gemini web fallback timed out after ${timeoutMs}ms; continuing with captured evidence.`
          : error instanceof Error
          ? `Gemini web fallback request failed: ${error.message}`
          : "Gemini web fallback request failed before a response was received."
      ]
    };
  } finally {
    clearTimeout(timeout);
  }
}
