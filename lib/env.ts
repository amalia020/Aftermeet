export interface ServerEnv {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  calaApiKey?: string;
  calaApiBaseUrl?: string;
  calaApiUrl?: string;
  calaApiAuthHeader?: string;
  calaApiAuthScheme?: string;
  geminiApiKey?: string;
  geminiModel: string;
  openaiApiKey?: string;
  openaiTranscriptionModel: string;
  openaiRealtimeTranscriptionModel: string;
  openaiRealtimeTranscriptionLanguage: string;
  openaiRealtimeTranscriptionDelay: string;
}

export function getServerEnv(): ServerEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    calaApiKey: process.env.CALA_API_KEY,
    calaApiBaseUrl: process.env.CALA_API_BASE_URL,
    calaApiUrl: process.env.CALA_API_URL,
    calaApiAuthHeader: process.env.CALA_API_AUTH_HEADER,
    calaApiAuthScheme: process.env.CALA_API_AUTH_SCHEME,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-transcribe",
    openaiRealtimeTranscriptionModel:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
    openaiRealtimeTranscriptionLanguage:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE ?? "en",
    openaiRealtimeTranscriptionDelay:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_DELAY ?? "auto",
  };
}

export function hasServerKey(key: keyof ServerEnv): boolean {
  return Boolean(getServerEnv()[key]);
}
