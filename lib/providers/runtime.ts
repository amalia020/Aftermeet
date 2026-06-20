/**
 * Shared provider runtime. Every external hop in the pipeline (ADR-001) is
 * wrapped in a timeout and returns a typed fallback instead of throwing, so the
 * orchestrator never dies on a slow or missing vendor. Server-only.
 */

import "server-only";

export interface ProviderOutcome<T> {
  ok: boolean;
  data: T;
  /** "live" when the vendor answered; "fallback" when we used the typed default. */
  mode: "live" | "fallback";
  warnings: string[];
}

export function liveOutcome<T>(data: T, warnings: string[] = []): ProviderOutcome<T> {
  return { ok: true, data, mode: "live", warnings };
}

export function fallbackOutcome<T>(
  data: T,
  warnings: string[] = [],
): ProviderOutcome<T> {
  return { ok: false, data, mode: "fallback", warnings };
}

/**
 * Run `fn` with a timeout. If it rejects or exceeds `ms`, resolve to the typed
 * `fallback` (computed lazily) and record a warning. Never throws.
 */
export async function withTimeout<T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<ProviderOutcome<T>>,
  fallback: () => ProviderOutcome<T>,
): Promise<ProviderOutcome<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fb = fallback();
    return {
      ...fb,
      warnings: [...fb.warnings, `${label} failed: ${message}`],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse JSON that may be wrapped in markdown fences or prose. Null on failure. */
export function safeJsonParse<T>(raw: string): T | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const candidates: string[] = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}
