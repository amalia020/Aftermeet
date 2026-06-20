import os from "node:os";
import path from "node:path";
import { beforeEach } from "vitest";
import { resetLocalDatabase } from "@/lib/db/client";

beforeEach(async () => {
  process.env.AFTERMEET_DB_PATH = path.join(
    os.tmpdir(),
    `aftermeet-test-${crypto.randomUUID()}.json`
  );
  delete process.env.OPENAI_API_KEY;
  delete process.env.CALA_API_KEY;
  delete process.env.CALA_API_BASE_URL;
  delete process.env.GEMINI_API_KEY;
  await resetLocalDatabase();
});

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function sseEvents(text: string) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data:\s*/, "")));
}
