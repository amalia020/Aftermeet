import { swaggerHtmlResponse } from "@/lib/server/swaggerHtml";

export const runtime = "nodejs";

export function GET() {
  return swaggerHtmlResponse();
}
