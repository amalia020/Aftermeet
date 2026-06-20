/**
 * Phase 5 — Cala provider (server-only).
 *
 * Cala is the PRIMARY public-context provider, scoped to company / investor /
 * fund / market context (ADR-003). It is always tried before the web fallback.
 *
 * IMPORTANT: the exact Cala HTTP surface is a deferred decision (SDD §8). The
 * fetch wiring below is BEST-EFFORT against a presumed REST shape. Every call is
 * timeout-wrapped and, when the key is absent / demo mode is forced / the call
 * fails, falls back cleanly to the saved Part 2 fixtures. These functions never
 * throw.
 */

import "server-only";
import { runtimeConfig, shouldRunLive } from "@/lib/config";
import {
  part2DemoCalaAnswer,
  part2DemoCalaCandidates,
  part2DemoCalaFacts,
} from "@/lib/demo/savedExamples";
import type {
  CalaEntityCandidate,
  CalaEntityDetail,
  CalaQueryResult,
  CalaSearchResult,
  EntityType,
} from "@/lib/types";
import {
  fallbackOutcome,
  liveOutcome,
  safeJsonParse,
  withTimeout,
  type ProviderOutcome,
} from "./runtime";

// Best-effort base URL; overridable via env without code changes.
const CALA_BASE_URL =
  process.env.CALA_API_URL?.trim() || "https://api.cala.ai/v1";

function authHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${runtimeConfig.keys.calaKey as string}`,
  };
}

async function calaFetch<T>(
  label: string,
  path: string,
  body: unknown,
  parse: (json: unknown) => T,
  fallback: () => ProviderOutcome<T>,
): Promise<ProviderOutcome<T>> {
  if (!shouldRunLive("cala")) {
    return fallbackOutcome(fallback().data, ["cala: no API key, using fixture"]);
  }
  return withTimeout<T>(
    label,
    runtimeConfig.timeouts.calaMs,
    async (signal) => {
      const response = await fetch(`${CALA_BASE_URL}${path}`, {
        method: "POST",
        signal,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const text = await response.text();
      const json = safeJsonParse<unknown>(text) ?? JSON.parse(text);
      return liveOutcome(parse(json));
    },
    fallback,
  );
}

function toEntityType(raw: unknown): EntityType {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  if (v === "person" || v === "company" || v === "fund") return v;
  return "unknown";
}

function parseCandidates(json: unknown): CalaEntityCandidate[] {
  const root = (json ?? {}) as Record<string, unknown>;
  const list =
    (root.candidates as unknown[]) ??
    (root.results as unknown[]) ??
    (root.entities as unknown[]) ??
    [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const name = (o.name ?? o.canonicalName ?? o.title) as string | undefined;
      if (!name) return null;
      const candidate: CalaEntityCandidate = {
        providerEntityId: String(o.id ?? o.entityId ?? o.providerEntityId ?? name),
        name,
        entityType: toEntityType(o.entityType ?? o.type),
        company: (o.company as string) ?? undefined,
        role: (o.role as string) ?? undefined,
        domain: (o.domain as string) ?? (o.website as string) ?? undefined,
        confidence:
          typeof o.confidence === "number" ? (o.confidence as number) : undefined,
      };
      return candidate;
    })
    .filter((c): c is CalaEntityCandidate => c !== null);
}

/** Free-text knowledge search → candidate entities. */
export async function calaKnowledgeSearch(
  input: string,
): Promise<CalaSearchResult> {
  const fallback = (): ProviderOutcome<CalaEntityCandidate[]> =>
    fallbackOutcome(part2DemoCalaCandidates, ["cala: search fallback fixture"]);

  const outcome = await calaFetch<CalaEntityCandidate[]>(
    "cala.search",
    "/knowledge/search",
    { query: input },
    parseCandidates,
    fallback,
  );

  return {
    available: outcome.mode === "live",
    candidates: outcome.data,
    warnings: outcome.warnings,
  };
}

/** Structured question → grounded answer + extracted facts. */
export async function calaKnowledgeQuery(
  input: string,
): Promise<CalaQueryResult> {
  const fallback = (): ProviderOutcome<{ answer: string; facts: string[] }> =>
    fallbackOutcome(
      { answer: part2DemoCalaAnswer, facts: part2DemoCalaFacts },
      ["cala: query fallback fixture"],
    );

  const parse = (json: unknown): { answer: string; facts: string[] } => {
    const o = (json ?? {}) as Record<string, unknown>;
    const answer = (o.answer ?? o.summary ?? o.text ?? "") as string;
    const factsRaw = (o.facts ?? o.claims ?? []) as unknown[];
    const facts = Array.isArray(factsRaw)
      ? factsRaw
          .map((f) =>
            typeof f === "string"
              ? f
              : ((f as Record<string, unknown>)?.text as string) ?? "",
          )
          .filter(Boolean)
      : [];
    return { answer, facts };
  };

  const outcome = await calaFetch(
    "cala.query",
    "/knowledge/query",
    { query: input },
    parse,
    fallback,
  );

  return {
    available: outcome.mode === "live",
    answer: outcome.data.answer || undefined,
    facts: outcome.data.facts,
    warnings: outcome.warnings,
  };
}

/** Name-based entity search → candidate list (no answer). */
export async function calaEntitySearch(
  name: string,
): Promise<CalaEntityCandidate[]> {
  const result = await calaKnowledgeSearch(name);
  return result.candidates;
}

/** Retrieve a single entity's structured detail by provider id. */
export async function calaRetrieveEntity(
  entityId: string,
): Promise<CalaEntityDetail> {
  const now = new Date().toISOString();
  const fallback = (): ProviderOutcome<CalaEntityDetail> => {
    const demo = part2DemoCalaCandidates[0];
    return fallbackOutcome(
      {
        providerEntityId: demo?.providerEntityId ?? entityId,
        entityType: demo?.entityType ?? "company",
        canonicalName: demo?.name ?? entityId,
        rawContext: {
          answer: part2DemoCalaAnswer,
          facts: part2DemoCalaFacts,
        },
        retrievedAt: now,
      },
      ["cala: retrieve fallback fixture"],
    );
  };

  const parse = (json: unknown): CalaEntityDetail => {
    const o = (json ?? {}) as Record<string, unknown>;
    return {
      providerEntityId: String(o.id ?? o.entityId ?? entityId),
      entityType: toEntityType(o.entityType ?? o.type),
      canonicalName: String(o.canonicalName ?? o.name ?? entityId),
      rawContext: (o.context ?? o.rawContext ?? o) as CalaEntityDetail["rawContext"],
      retrievedAt: (o.retrievedAt as string) ?? now,
    };
  };

  const outcome = await calaFetch<CalaEntityDetail>(
    "cala.retrieve",
    `/knowledge/entity`,
    { entityId },
    parse,
    fallback,
  );
  return outcome.data;
}
