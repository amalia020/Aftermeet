import { jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export function GET() {
  return jsonResponse({
    ok: true,
    service: "aftermeet-intelligence-layer",
    timestamp: new Date().toISOString()
  });
}
