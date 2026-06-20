/**
 * Voice transcription provider (ADR-002, Part 1).
 *
 * Uses the OpenAI audio transcription API when an OPENAI_API_KEY is configured.
 * Otherwise (or on any failure/timeout) it falls back to the saved demo
 * transcript. Server-only; audio never touches the browser.
 *
 * Never throws — wrapped in withTimeout, returns a typed ProviderOutcome.
 */

import "server-only";

import { runtimeConfig, shouldRunLive } from "@/lib/config";
import {
  fallbackOutcome,
  liveOutcome,
  withTimeout,
  type ProviderOutcome,
} from "@/lib/providers/runtime";
import { part1DemoTranscript } from "@/lib/demo/savedExamples";

const OPENAI_TRANSCRIBE_URL =
  "https://api.openai.com/v1/audio/transcriptions";

export interface TranscribeAudioInput {
  audio: ArrayBuffer | Blob;
  mimeType?: string;
  now?: Date;
}

export interface TranscribeAudioResult {
  transcript: string;
}

function toBlob(audio: ArrayBuffer | Blob, mimeType?: string): Blob {
  if (audio instanceof Blob) return audio;
  return new Blob([audio], { type: mimeType ?? "audio/webm" });
}

function fileExtensionForMime(mimeType?: string): string {
  if (!mimeType) return "webm";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("m4a") || mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Transcribe a short voice note. Falls back to the demo transcript whenever a
 * live call is unavailable or fails.
 */
export async function transcribeAudio(
  input: TranscribeAudioInput,
): Promise<ProviderOutcome<TranscribeAudioResult>> {
  if (!shouldRunLive("whisper")) {
    return fallbackOutcome(
      { transcript: part1DemoTranscript },
      ["whisper: no API key, using fixture transcript"],
    );
  }

  return withTimeout<TranscribeAudioResult>(
    "whisper",
    runtimeConfig.timeouts.transcribeMs,
    async (signal) => {
      const blob = toBlob(input.audio, input.mimeType);
      const ext = fileExtensionForMime(input.mimeType ?? blob.type);

      const form = new FormData();
      form.append("file", blob, `voice-note.${ext}`);
      form.append("model", runtimeConfig.models.openaiTranscribe);
      form.append("response_format", "json");

      const response = await fetch(OPENAI_TRANSCRIBE_URL, {
        method: "POST",
        signal,
        headers: {
          authorization: `Bearer ${runtimeConfig.keys.openaiKey as string}`,
        },
        body: form,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const json = (await response.json()) as { text?: string };
      const transcript = (json.text ?? "").trim();
      if (!transcript) throw new Error("empty transcript");

      return liveOutcome({ transcript });
    },
    () =>
      fallbackOutcome(
        { transcript: part1DemoTranscript },
        ["whisper: call failed, using fixture transcript"],
      ),
  );
}
