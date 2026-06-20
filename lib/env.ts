export interface ServerEnv {
  calaApiKey?: string;
  calaApiBaseUrl?: string;
  calaApiUrl?: string;
  calaApiAuthHeader?: string;
  calaApiAuthScheme?: string;
  geminiApiKey?: string;
  geminiModel: string;
  openaiApiKey?: string;
  openaiTranscriptionModel: string;
}

export function getServerEnv(): ServerEnv {
  return {
    calaApiKey: process.env.CALA_API_KEY,
    calaApiBaseUrl: process.env.CALA_API_BASE_URL,
    calaApiUrl: process.env.CALA_API_URL,
    calaApiAuthHeader: process.env.CALA_API_AUTH_HEADER,
    calaApiAuthScheme: process.env.CALA_API_AUTH_SCHEME,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-transcribe"
  };
}

export function hasServerKey(key: keyof ServerEnv): boolean {
  return Boolean(getServerEnv()[key]);
}
