import "server-only";

import { getServerEnv } from "@/lib/env";
import type { ContactCandidate } from "@/lib/types";
import { safeJsonParse } from "@/lib/providers/runtime";

export interface CardVisionResult {
  rawText: string;
  contactCandidate: ContactCandidate;
  provider: "gemini";
  model: string;
  warnings: string[];
}

interface GeminiCardPayload extends ContactCandidate {
  rawText?: unknown;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function recognizeBusinessCard(input: {
  imageFile: File;
  timeoutMs?: number;
}): Promise<CardVisionResult> {
  const env = getServerEnv();
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured for card recognition.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);

  try {
    const imageData = Buffer.from(await input.imageFile.arrayBuffer()).toString("base64");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: [
                  "Read the supplied business card image.",
                  "Transcribe only visible text and extract professional contact fields.",
                  "Do not infer or invent missing values. Return JSON only."
                ].join(" ")
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "Extract rawText, name, role, company, email, phone, website, and linkedinUrl." },
                {
                  inline_data: {
                    mime_type: input.imageFile.type || "image/jpeg",
                    data: imageData
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            response_mime_type: "application/json"
          }
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 160).replace(/\s+/g, " ");
      throw new Error(`Gemini card recognition failed with status ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      modelVersion?: string;
    };
    const responseText = body.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "";
    const parsed = safeJsonParse<GeminiCardPayload>(responseText);
    const rawText = optionalString(parsed?.rawText);
    if (!parsed || !rawText) {
      throw new Error("Gemini returned no usable business card text.");
    }

    return {
      rawText,
      contactCandidate: {
        name: optionalString(parsed.name),
        role: optionalString(parsed.role),
        company: optionalString(parsed.company),
        email: optionalString(parsed.email),
        phone: optionalString(parsed.phone),
        website: optionalString(parsed.website),
        linkedinUrl: optionalString(parsed.linkedinUrl)
      },
      provider: "gemini",
      model: body.modelVersion ?? env.geminiModel,
      warnings: []
    };
  } finally {
    clearTimeout(timeout);
  }
}
