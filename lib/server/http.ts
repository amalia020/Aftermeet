import type { ErrorResponse, Id } from "@/lib/types";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonResponse<T>(body: T, init?: ResponseInit | number): Response {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return Response.json(body, responseInit);
}

export function errorResponse(error: unknown, requestId?: Id): Response {
  if (error instanceof HttpError) {
    const payload: ErrorResponse = {
      error: error.code,
      message: error.message,
      details: error.details,
      requestId
    };
    return jsonResponse(payload, error.status);
  }

  const payload: ErrorResponse = {
    error: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unexpected server error.",
    requestId
  };
  return jsonResponse(payload, 500);
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", `${field} is required.`, {
      [field]: "required"
    });
  }
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function createRequestId(prefix = "req"): Id {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
