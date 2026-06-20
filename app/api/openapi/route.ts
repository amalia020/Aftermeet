import { createOpenApiDocument } from "@/lib/server/openapi";

export const runtime = "nodejs";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(createOpenApiDocument(origin));
}
