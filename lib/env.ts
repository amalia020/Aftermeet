export interface ServerEnv {
  calaApiKey?: string;
  calaApiBaseUrl?: string;
  calaApiUrl?: string;
  calaApiAuthHeader?: string;
  calaApiAuthScheme?: string;
  geminiApiKey?: string;
  geminiModel: string;
  openaiApiKey?: string;
  openaiTranscriptionLanguage: string;
  openaiTranscriptionModel: string;
  openaiRealtimeTranscriptionDelay: "minimal" | "low" | "medium" | "high" | "xhigh";
  openaiRealtimeTranscriptionLanguage: string;
  openaiRealtimeTranscriptionModel: string;
}

export function getServerEnv(): ServerEnv {
  const realtimeDelay = process.env.OPENAI_REALTIME_TRANSCRIPTION_DELAY;
  return {
    calaApiKey: process.env.CALA_API_KEY,
    calaApiBaseUrl: process.env.CALA_API_BASE_URL,
    calaApiUrl: process.env.CALA_API_URL,
    calaApiAuthHeader: process.env.CALA_API_AUTH_HEADER,
    calaApiAuthScheme: process.env.CALA_API_AUTH_SCHEME,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiTranscriptionLanguage: process.env.OPENAI_TRANSCRIPTION_LANGUAGE ?? "nl",
    openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-transcribe",
    openaiRealtimeTranscriptionDelay:
      realtimeDelay === "minimal" ||
      realtimeDelay === "low" ||
      realtimeDelay === "medium" ||
      realtimeDelay === "high" ||
      realtimeDelay === "xhigh"
        ? realtimeDelay
        : "low",
    openaiRealtimeTranscriptionLanguage: process.env.OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE ?? "nl",
    openaiRealtimeTranscriptionModel:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-realtime-whisper"
  };
}

export function hasServerKey(key: keyof ServerEnv): boolean {
  return Boolean(getServerEnv()[key]);
}
