import type { ProcessStage } from "@/lib/types";

/**
 * Central hub for user-facing copy.
 *
 * Aftermeet is a consumer product, so nothing here should expose internal
 * mechanics: no vendor/provider names (Cala, Gemini, OpenAI…), no pipeline
 * vocabulary (atoms, entity, enrichment, decision trace…), and no raw model
 * confidence numbers. Keep wording warm, plain, and second-person.
 */

/** Friendly labels for the live capture progress strip. Internal stage ids
 *  (e.g. "persisting_atoms") must never reach the screen. */
export const CAPTURE_STAGE_LABELS: Record<ProcessStage, string> = {
  capturing: "Saving your note",
  transcribing: "Transcribing",
  extracting: "Reading your note",
  persisting_atoms: "Reading your note",
  resolving_entity: "Finding who this is",
  retrieving_context: "Looking them up",
  scoring_routes: "Weighing your options",
  choosing_action: "Picking the best move",
  generating_draft: "Writing your message",
  handoff_ready: "Ready",
  failed: "Something went wrong",
};

export function captureStageLabel(stage: ProcessStage): string {
  return CAPTURE_STAGE_LABELS[stage] ?? "Working";
}

// Provider / internal terms that must never be shown to a consumer. Used as a
// final safety net: any surviving warning that still mentions one is dropped.
const VENDOR_TERMS = /\b(cala|gemini|openai|whisper|webrtc|llm|api[_ ]?key)\b/i;

// Internal diagnostics that carry no useful meaning for a consumer — dropped
// outright rather than reworded.
const DROP_PATTERNS: RegExp[] = [
  /timed out/i,
  /uncited/i,
  /no usable (public context|model response)/i,
  /public context unavailable/i,
  /web fallback/i,
  /persistence unavailable/i,
  /in-memory/i,
  /fixture/i,
  /fell back to demo/i,
  /no evidence facts available/i,
];

// Internal phrasings reworded into warm, plain consumer language.
const REWRITE_RULES: { match: RegExp; replacement: string }[] = [
  {
    match: /below 50%|may be inaccurate|requires confirmation|entity match is low|entity confidence is low/i,
    replacement: "We're not fully sure of these details — double-check before sending.",
  },
  {
    match: /no safe facts available/i,
    replacement: "Not enough confirmed info for a message yet.",
  },
];

/**
 * Turn the pipeline's raw warning strings into consumer-safe messages: drop
 * pure diagnostics, reword the meaningful ones, strip anything still naming a
 * provider, and de-duplicate.
 */
export function friendlyWarnings(warnings: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const warning of warnings) {
    if (DROP_PATTERNS.some((pattern) => pattern.test(warning))) continue;

    const rule = REWRITE_RULES.find(({ match }) => match.test(warning));
    const message = rule ? rule.replacement : warning;

    // Anything that still references an internal/vendor term after rewriting is
    // not safe to show — drop it.
    if (VENDOR_TERMS.test(message)) continue;

    const key = message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(message);
  }

  return out;
}

// Trim a single fact for display: strip leaked JSON scaffolding / citation
// markers, then cap length to one readable line.
export function tidyFact(raw: string, maxLength = 200): string {
  let text = (raw ?? "").trim();
  // Drop a leading JSON key wrapper, e.g.  {"summary": "  or  "text": "
  text = text.replace(/^[\s[\]{},]*"?(?:text|fact|summary|claims)"?\s*:\s*\[?\s*"?/i, "");
  // If JSON leaked in, cut at the first structural break into another field/array.
  const breakAt = text.search(
    /"\s*,\s*"(?:claims|summary|sourceurl|sourcetype|available|text|fact)"|"\s*:\s*\[/i,
  );
  if (breakAt !== -1) text = text.slice(0, breakAt);
  // Remove inline citation markers like [2.1.2] or [3].
  text = text.replace(/\s*\[\d+(?:\.\d+)*\]/g, "");
  text = text.replace(/^["'\s]+/, "").replace(/["'\s,}\]]+$/, "").trim();

  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLength).trim()}…`;
  }
  return text;
}

/** Clean, de-duplicate and cap a list of facts for display. */
export function tidyFacts(facts: string[], options?: { max?: number; maxLength?: number }): string[] {
  const max = options?.max ?? 6;
  const maxLength = options?.maxLength ?? 200;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const fact of facts) {
    const text = tidyFact(fact, maxLength);
    const key = text.toLowerCase();
    if (text.length < 4 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export type ConfidenceLevel = "solid" | "fair" | "unverified";

/** A single qualitative read on a recommendation's confidence, replacing the
 *  raw entity/source/fact/final percentages. */
export function confidenceLevel(finalConfidence: number): ConfidenceLevel {
  if (finalConfidence >= 0.7) return "solid";
  if (finalConfidence >= 0.45) return "fair";
  return "unverified";
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  solid: "Looks solid",
  fair: "Worth a check",
  unverified: "Needs confirming",
};
