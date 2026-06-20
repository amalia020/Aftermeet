/**
 * Deterministic, dependency-free helpers shared across the intelligence layer.
 * Pure functions only — no I/O, no randomness, no clock reads beyond what the
 * caller passes in. Safe to import from any workstream.
 */

/** Clamp a number into the [0, 1] range. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Clamp into an arbitrary [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Average of a list; 0 when empty. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Round to n decimal places (deterministic display helper). */
export function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token set of a normalized string. */
function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter(Boolean));
}

/**
 * Jaccard token-set similarity in [0, 1]. Used for name/company/role matching
 * in entity resolution. Returns 0 when either side is empty.
 */
export function tokenSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalized Levenshtein similarity in [0, 1]. Better than Jaccard for short
 * single-token names (e.g. "Maya" vs "Mya").
 */
export function stringSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;
  const distance = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return clamp01(1 - distance / maxLen);
}

/** Combined name/company similarity: best of token-set and edit-distance. */
export function nameSimilarity(a?: string | null, b?: string | null): number {
  return Math.max(tokenSimilarity(a, b), stringSimilarity(a, b));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Extract a bare domain from a URL or email; null when not derivable. */
export function extractDomain(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) {
    const parts = trimmed.split("@");
    return parts[1] ?? null;
  }
  const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([^/\s]+)/);
  return match ? match[1] : null;
}

/**
 * Exponential freshness in [0, 1] given an ISO timestamp and half-life in hours.
 * `now` is injected for determinism in tests.
 */
export function freshnessScore(
  retrievedAt: string | null | undefined,
  now: Date,
  halfLifeHours = 24 * 30,
): number {
  if (!retrievedAt) return 0;
  const then = Date.parse(retrievedAt);
  if (Number.isNaN(then)) return 0;
  const hours = Math.max(0, (now.getTime() - then) / (1000 * 60 * 60));
  return clamp01(Math.exp((-Math.LN2 * hours) / halfLifeHours));
}

/** Deterministic id generator. Pass a stable seed; never uses randomness. */
export function deterministicId(prefix: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}
