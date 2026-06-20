/**
 * Low-level Claude JSON-completion wrapper (shared-with-care per ownership map).
 * This file holds ONLY the transport. Prompts live in the workstream files
 * (extraction.ts, draftGeneration.ts) — do not put prompt logic here.
 *
 * Returns a ProviderOutcome<string> with the raw model text. Callers parse JSON
 * with safeJsonParse and supply their own typed fallback. Server-only.
 */

import "server-only";
import { runtimeConfig, shouldRunLive } from "@/lib/config";
import { fallbackOutcome, liveOutcome, withTimeout, type ProviderOutcome } from "./runtime";

export interface ClaudeCompleteInput {
  system: string;
  user: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/**
 * Call Claude Messages API and return raw assistant text. When no key is
 * configured (or demo mode is forced), returns a fallback outcome with empty
 * text so the caller uses its fixture.
 */
export async function claudeComplete(
  input: ClaudeCompleteInput,
): Promise<ProviderOutcome<string>> {
  if (!shouldRunLive("claude")) {
    return fallbackOutcome("", ["claude: no API key, using fixture"]);
  }

  const timeout = input.timeoutMs ?? runtimeConfig.timeouts.extractionMs;

  return withTimeout<string>(
    "claude",
    timeout,
    async (signal) => {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": runtimeConfig.keys.anthropicKey as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: runtimeConfig.models.anthropic,
          max_tokens: input.maxTokens ?? 1500,
          temperature: input.temperature ?? 0.2,
          system: input.system,
          messages: [{ role: "user", content: input.user }],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const json = (await response.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text =
        json.content
          ?.filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("\n")
          .trim() ?? "";

      if (!text) throw new Error("empty completion");
      return liveOutcome(text);
    },
    () => fallbackOutcome("", ["claude: call failed, using fixture"]),
  );
}
