import type {
  CalaEntityCandidate,
  CalaEntityDetail,
  CalaQueryResult,
  CalaSearchResult,
  JsonValue
} from "@/lib/types";
import { getServerEnv } from "@/lib/env";
import { demoCalaCandidate, demoCalaDetail } from "@/lib/demo/fixtures";

const knowledgeDetailCache = new Map<string, CalaEntityDetail>();

function looksLikeRecursive(value: string): boolean {
  return value.toLowerCase().includes("recursive");
}

function configuredAuthHeader() {
  const env = getServerEnv();
  const header = (env.calaApiAuthHeader ?? "Authorization").trim() || "Authorization";
  const scheme =
    env.calaApiAuthScheme ?? (header.toLowerCase() === "authorization" ? "Bearer" : "");
  return { header, scheme };
}

function authHeaders(): HeadersInit | null {
  const env = getServerEnv();
  if (!env.calaApiKey) return null;
  const { header, scheme } = configuredAuthHeader();
  return {
    "content-type": "application/json",
    [header]: scheme ? `${scheme} ${env.calaApiKey}` : env.calaApiKey
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  let suffix = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/v1") && suffix.startsWith("/v1/")) {
    suffix = suffix.slice(3);
  }
  return `${base}${suffix}`;
}

function isKnowledgeEndpoint(url: string): boolean {
  return /\/knowledge\/(query|search)/i.test(url);
}

function resolveEntityBaseUrl(): string | null {
  const env = getServerEnv();
  const configured = env.calaApiBaseUrl?.trim() || env.calaApiUrl?.trim();
  if (!configured || isKnowledgeEndpoint(configured)) return null;
  return configured;
}

function resolveKnowledgeUrl(): string | null {
  const env = getServerEnv();
  const direct = env.calaApiUrl?.trim() || env.calaApiBaseUrl?.trim();
  if (!direct) return null;
  if (isKnowledgeEndpoint(direct)) return direct;
  return joinUrl(direct, "/v1/knowledge/query");
}

async function calaFetchUrl<T>(url: string, payload: JsonValue): Promise<T | null> {
  const headers = authHeaders();
  if (!headers) return null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function calaFetchPath<T>(path: string, payload: JsonValue): Promise<T | null> {
  const baseUrl = resolveEntityBaseUrl();
  if (!baseUrl) return null;
  return calaFetchUrl<T>(joinUrl(baseUrl, path), payload);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function extractRows(raw: unknown): Record<string, unknown>[] {
  const root = asObject(raw);
  if (!root) return [];
  const directResults = root.results;
  if (Array.isArray(directResults)) {
    return directResults.map((item) => asObject(item)).filter(Boolean) as Record<string, unknown>[];
  }
  return [];
}

function mapKnowledgeRowToCandidate(row: Record<string, unknown>, fallbackName: string): CalaEntityCandidate {
  const name = asString(row.full_name) ?? asString(row.name) ?? fallbackName;
  const company = asString(row.company) ?? asString(row.organization) ?? undefined;
  const role = asString(row.role) ?? asString(row.title) ?? undefined;
  const providerEntityId =
    asString(row.providerEntityId) ?? asString(row.entity_id) ?? `knowledge_${crypto.randomUUID()}`;
  const domain = asString(row.domain);
  const confidenceValue = row.confidence;
  const confidence =
    typeof confidenceValue === "number" && Number.isFinite(confidenceValue)
      ? Math.min(1, Math.max(0, confidenceValue))
      : 0.6;

  let entityType: CalaEntityCandidate["entityType"] = "unknown";
  if (company && name) {
    entityType = "person";
  } else if (company) {
    entityType = "company";
  }

  const detail: CalaEntityDetail = {
    providerEntityId,
    entityType,
    canonicalName: company ?? name,
    rawContext: row as unknown as JsonValue,
    retrievedAt: new Date().toISOString()
  };
  knowledgeDetailCache.set(providerEntityId, detail);

  return {
    providerEntityId,
    name,
    entityType,
    company,
    role,
    domain,
    confidence
  };
}

async function knowledgeCandidates(input: string): Promise<CalaEntityCandidate[]> {
  const knowledgeUrl = resolveKnowledgeUrl();
  if (!knowledgeUrl) return [];
  const raw = await calaFetchUrl<unknown>(knowledgeUrl, { input });
  const rows = extractRows(raw);
  return rows.map((row) => mapKnowledgeRowToCandidate(row, input));
}

export async function calaKnowledgeSearch(input: string): Promise<CalaSearchResult> {
  const candidates = await knowledgeCandidates(input);
  if (candidates.length > 0) {
    return {
      available: true,
      candidates,
      rawResponse: { mode: "knowledge_query" },
      warnings: []
    };
  }

  if (looksLikeRecursive(input)) {
    return {
      available: true,
      candidates: [demoCalaCandidate],
      rawResponse: { fixture: true },
      warnings: ["Using Cala fixture because live Cala configuration is unavailable."]
    };
  }

  return {
    available: false,
    candidates: [],
    rawResponse: { fixture: true },
    warnings: ["Cala unavailable or no fixture match found."]
  };
}

export async function calaKnowledgeQuery(input: string): Promise<CalaQueryResult> {
  const candidates = await knowledgeCandidates(input);
  if (candidates.length > 0) {
    const facts = candidates.map((candidate) => {
      const name = candidate.name;
      const company = candidate.company ?? "an unknown company";
      const role = candidate.role ? `${candidate.role} at ${company}` : `associated with ${company}`;
      return `${name} is ${role}.`;
    });
    return {
      available: true,
      answer: facts[0],
      facts,
      rawResponse: { mode: "knowledge_query" },
      warnings: []
    };
  }

  if (looksLikeRecursive(input)) {
    const raw = demoCalaDetail.rawContext as { facts?: string[]; summary?: string };
    return {
      available: true,
      answer: raw.summary,
      facts: raw.facts ?? [],
      rawResponse: { fixture: true },
      warnings: ["Using Cala query fixture because live Cala configuration is unavailable."]
    };
  }

  return {
    available: false,
    facts: [],
    rawResponse: { fixture: true },
    warnings: ["Cala query unavailable or no fixture match found."]
  };
}

export async function calaEntitySearch(name: string): Promise<CalaEntityCandidate[]> {
  const live = await calaFetchPath<{ candidates?: CalaEntityCandidate[] }>("/v1/entities/search", {
    query: name
  });
  if (live?.candidates) return live.candidates;

  const knowledge = await knowledgeCandidates(name);
  if (knowledge.length > 0) return knowledge;

  return looksLikeRecursive(name) ? [demoCalaCandidate] : [];
}

export async function calaRetrieveEntity(entityId: string): Promise<CalaEntityDetail | null> {
  const cached = knowledgeDetailCache.get(entityId);
  if (cached) return cached;

  const live = await calaFetchPath<CalaEntityDetail>("/v1/entities/retrieve", { entityId });
  if (live) return live;
  return entityId === demoCalaCandidate.providerEntityId ? demoCalaDetail : null;
}
