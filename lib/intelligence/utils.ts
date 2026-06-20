import type { SourceType } from "@/lib/types";

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

export function normalizeText(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value?: string | null): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function tokenSimilarity(left?: string | null, right?: string | null): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  const containment =
    leftText.includes(rightText) || rightText.includes(leftText) ? Math.min(leftText.length, rightText.length) / Math.max(leftText.length, rightText.length) : 0;
  return roundScore(Math.max(jaccard, containment));
}

export function domainFromValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeText(value);
  const emailDomain = normalized.match(/@([a-z0-9.-]+\.[a-z]{2,})/)?.[1];
  if (emailDomain) return emailDomain.replace(/^www\./, "");

  try {
    const withProtocol = value.startsWith("http") ? value : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.replace(/^www\./, "");
    return hostname || undefined;
  } catch {
    const match = normalized.match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0];
    return match?.replace(/^www\./, "");
  }
}

export function freshnessScore(retrievedAt?: string | null, now = new Date()): number {
  if (!retrievedAt) return 0.4;
  const timestamp = new Date(retrievedAt).getTime();
  if (Number.isNaN(timestamp)) return 0.35;

  const days = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (days <= 90) return 1;
  if (days <= 365) return 0.85;
  if (days <= 1095) return 0.6;
  return 0.35;
}

export function inferSourceTypeFromUrl(url?: string | null): SourceType {
  if (!url) return "unknown";
  const domain = domainFromValue(url) ?? "";
  const path = url.toLowerCase();

  if (domain.includes("linkedin.com")) return "unknown";
  if (path.includes("/press") || path.includes("/news") || path.includes("prnewswire")) {
    return "official_press";
  }
  if (path.includes("/fund") || domain.includes("capital") || domain.includes("ventures")) {
    return "fund_website";
  }
  if (domain.includes("techcrunch") || domain.includes("forbes") || domain.includes("sifted")) {
    return "reputable_news";
  }
  if (path.includes("/about") || path.includes("/events") || path.includes("/careers")) {
    return "company_website";
  }
  return "search_snippet";
}
