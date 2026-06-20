import { getServerEnv } from "@/lib/env";
import { demoTranscript } from "@/lib/demo/fixtures";

export interface TranscriptionResult {
  transcript: string;
  provider: "openai" | "fixture";
  model?: string;
  durationMs: number;
  warnings: string[];
}

export function isSupportedAudio(file: File | Blob): boolean {
  return !file.type || file.type.startsWith("audio/");
}

export async function transcribeVoiceNote(input: {
  audioFile: File | Blob;
  languageHint?: string;
  timeoutMs?: number;
}): Promise<TranscriptionResult> {
  const startedAt = Date.now();
  const env = getServerEnv();

  if (!env.openaiApiKey) {
    return {
      transcript: demoTranscript,
      provider: "fixture",
      model: "aftermeet-demo-transcript",
      durationMs: Date.now() - startedAt,
      warnings: ["OPENAI_API_KEY is not set; using fixture transcription."]
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);

  try {
    const form = new FormData();
    form.append("file", input.audioFile, "voice-note.webm");
    form.append("model", env.openaiTranscriptionModel);
    if (input.languageHint) form.append("language", input.languageHint);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.openaiApiKey}`
      },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        transcript: demoTranscript,
        provider: "fixture",
        model: env.openaiTranscriptionModel,
        durationMs: Date.now() - startedAt,
        warnings: [`OpenAI transcription failed with status ${response.status}; using fixture.`]
      };
    }

    const body = (await response.json()) as { text?: string };
    return {
      transcript: body.text?.trim() || demoTranscript,
      provider: "openai",
      model: env.openaiTranscriptionModel,
      durationMs: Date.now() - startedAt,
      warnings: body.text ? [] : ["OpenAI transcription returned empty text; using fixture text."]
    };
  } catch (error) {
    return {
      transcript: demoTranscript,
      provider: "fixture",
      model: env.openaiTranscriptionModel,
      durationMs: Date.now() - startedAt,
      warnings: [
        error instanceof Error
          ? `OpenAI transcription failed: ${error.message}; using fixture.`
          : "OpenAI transcription failed; using fixture."
      ]
    };
  } finally {
    clearTimeout(timeout);
  }
}
