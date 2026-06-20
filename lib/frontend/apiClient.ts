/**
 * Typed fetch wrappers for the AfterMeet app API routes (Part 4).
 *
 * These wrappers only ever call our own /api routes. They never touch providers,
 * the database, or intelligence modules directly. Every call returns a small
 * discriminated result so callers can fall back to fixtures without throwing.
 *
 * Fixture-first rule: screens render from fixtures by default. These wrappers are
 * used to *hydrate* from live data when it's available; on any failure the caller
 * keeps showing fixture data and flips a "demo" badge.
 */

import type {
  CaptureAcceptedResponse,
  DraftGenerateRequest,
  DraftGenerateResponse,
  OutcomeCreateRequest,
  OutcomeCreateResponse,
  RecommendResponse,
  TextCaptureRequest,
  TractionSummary,
  UserObjectiveProfile,
  UserObjectiveProfileInput,
} from "@/lib/types";

export const DEMO_USER_ID = "user_demo";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const payload = (await res.json()) as { message?: string };
        if (payload?.message) message = payload.message;
      } catch {
        /* ignore parse error */
      }
      return { ok: false, error: message, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function getJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `Request failed (${res.status})`, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** POST /api/capture/text — submit a raw text capture; returns the stream pointer. */
export function captureText(
  input: Omit<TextCaptureRequest, "userId"> & { userId?: string },
): Promise<ApiResult<CaptureAcceptedResponse>> {
  const body: TextCaptureRequest = {
    userId: input.userId ?? DEMO_USER_ID,
    rawText: input.rawText,
    eventContext: input.eventContext,
    capturedAt: input.capturedAt,
  };
  return postJson<CaptureAcceptedResponse>("/api/capture/text", body);
}

/** GET /api/objectives — read the active objective for the demo user. */
export async function getObjective(): Promise<ApiResult<UserObjectiveProfile | null>> {
  const result = await getJson<{ objective: UserObjectiveProfile | null }>(
    "/api/objectives",
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.objective };
}

/** POST /api/objectives — create or update the active objective. */
export function saveObjective(
  input: UserObjectiveProfileInput,
): Promise<ApiResult<UserObjectiveProfile>> {
  return postJson<UserObjectiveProfile>("/api/objectives", input);
}

/** POST /api/intelligence/recommend — recompute a recommendation package. */
export function recommend(input: {
  conversationId: string;
  contactId?: string;
  userId?: string;
}): Promise<ApiResult<RecommendResponse>> {
  return postJson<RecommendResponse>("/api/intelligence/recommend", {
    userId: input.userId ?? DEMO_USER_ID,
    conversationId: input.conversationId,
    contactId: input.contactId,
  });
}

/** POST /api/draft/generate — regenerate a draft for a recommendation. */
export function generateDraft(
  input: Omit<DraftGenerateRequest, "userId"> & { userId?: string },
): Promise<ApiResult<DraftGenerateResponse>> {
  return postJson<DraftGenerateResponse>("/api/draft/generate", {
    userId: input.userId ?? DEMO_USER_ID,
    recommendationId: input.recommendationId,
    tone: input.tone,
  });
}

/** POST /api/outcomes — record a manual outcome (sent/reply/booked/wtp/paid). */
export function recordOutcome(
  input: Omit<OutcomeCreateRequest, "userId"> & { userId?: string },
): Promise<ApiResult<OutcomeCreateResponse>> {
  return postJson<OutcomeCreateResponse>("/api/outcomes", {
    userId: input.userId ?? DEMO_USER_ID,
    contactId: input.contactId,
    recommendationId: input.recommendationId,
    outcomeType: input.outcomeType,
    notes: input.notes,
    value: input.value,
  });
}

/** GET /api/outcomes — read the current traction summary. */
export function getTraction(): Promise<ApiResult<TractionSummary>> {
  return getJson<TractionSummary>("/api/outcomes");
}

/** POST /api/demo/reset — wipe and re-seed the demo store. */
export function resetDemo(): Promise<ApiResult<{ ok: boolean }>> {
  return postJson<{ ok: boolean }>("/api/demo/reset", {});
}

/** Build the SSE stream URL for an accepted capture response. */
export function processStreamUrl(accepted: CaptureAcceptedResponse): string {
  if (accepted.streamUrl) return accepted.streamUrl;
  const params = new URLSearchParams({
    conversationId: accepted.conversationId,
    requestId: accepted.requestId,
  });
  return `/api/intelligence/process?${params.toString()}`;
}
