import { getServerEnv } from "@/lib/env";
import { resolveRequestUserId } from "@/lib/auth/request";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

interface RealtimeTranscriptionSessionRequest {
  userId?: string;
}

interface RealtimeClientSecretResponse {
  value?: string;
  client_secret?: {
    value?: string;
  };
  expires_at?: number;
  session?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<RealtimeTranscriptionSessionRequest>(request);
    const userId = await resolveRequestUserId(body.userId);
    const env = getServerEnv();
    if (!env.openaiApiKey) {
      throw new HttpError(503, "OPENAI_NOT_CONFIGURED", "OPENAI_API_KEY is required for realtime transcription.");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": userId,
      },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: 600,
        },
        session: {
          type: "transcription",
          audio: {
            input: {
              noise_reduction: {
                type: "near_field",
              },
              transcription: {
                model: env.openaiRealtimeTranscriptionModel,
                language: env.openaiRealtimeTranscriptionLanguage,
                delay: env.openaiRealtimeTranscriptionDelay,
              },
              turn_detection: null,
            },
          },
        },
      }),
    });

    const data = (await response.json()) as RealtimeClientSecretResponse & {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new HttpError(
        response.status,
        "REALTIME_SESSION_FAILED",
        data.error?.message ?? "Could not create realtime transcription session.",
      );
    }

    const clientSecret = data.client_secret?.value ?? data.value;
    if (!clientSecret) {
      throw new HttpError(502, "REALTIME_SESSION_INVALID", "Realtime session response did not include a client secret.");
    }

    return jsonResponse({
      clientSecret,
      expiresAt: data.expires_at,
      model: env.openaiRealtimeTranscriptionModel,
      language: env.openaiRealtimeTranscriptionLanguage,
      delay: env.openaiRealtimeTranscriptionDelay,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
