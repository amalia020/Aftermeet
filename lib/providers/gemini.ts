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
    const claims: WebContextClaim[] = rawClaims
          .filter(
            (claim): claim is Record<string, unknown> =>
              typeof claim === "object" &&
              claim !== null &&
              "text" in claim &&
              typeof claim.text === "string"
          )
          .map((claim) => ({
            text: String(claim.text),
            sourceUrl: typeof claim.sourceUrl === "string" ? claim.sourceUrl : "",
            sourceType:
              typeof claim.sourceType === "string"
                ? claim.sourceType
                : inferSourceTypeFromUrl(typeof claim.sourceUrl === "string" ? claim.sourceUrl : "")
          })) as WebContextClaim[];
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

function normalizeGroundedText(text: string): string {
  return text
    .replace(/^[\s\x5b\x5d{},]*"?(?:text|fact)"?\s*:\s*"?/i, "")
    .replace(/["\s,}\]]+$/, "")
    .trim();
}

export function parseGroundedGeminiCandidate(
  candidate: GeminiGroundedCandidate,
  retrievedAt = new Date().toISOString()
): WebContextResult | null {
  const text = candidate.content?.parts?.find((part) => part.text)?.text ?? "";
  const parsed = parseGeminiJson(text);
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const supports = candidate.groundingMetadata?.groundingSupports ?? [];
  const groundedClaims: WebContextClaim[] = [];

  for (const support of supports) {
    const fact = normalizeGroundedText(support.segment?.text ?? "");
    if (!fact) continue;
    for (const index of support.groundingChunkIndices ?? []) {
      const sourceUrl = chunks[index]?.web?.uri;
      if (!sourceUrl) continue;
      groundedClaims.push({
        text: fact,
        sourceUrl,
        sourceType: inferSourceTypeFromUrl(sourceUrl)
      });
    }
  }

  const directClaims =
    parsed?.claims.filter(
      (claim) =>
        Boolean(claim.sourceUrl) ||
        !groundedClaims.some((grounded) => grounded.text === claim.text)
    ) ?? [];
  const claims = [...directClaims, ...groundedClaims].filter(
    (claim, index, all) =>
      all.findIndex(
        (other) => other.text === claim.text && other.sourceUrl === claim.sourceUrl
      ) === index
  );
  if (!parsed && !claims.length) return null;

  return {
    summary: parsed?.summary || text.trim(),
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
