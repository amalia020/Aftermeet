import type { ProcessConversationRequestBody, ProcessStageEvent } from "@/lib/types";
import { processConversation } from "@/lib/intelligence/process";
import { errorResponse, parseJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";

function encodeEvent(event: ProcessStageEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  let body: ProcessConversationRequestBody | undefined;
  try {
    body = await parseJsonBody<ProcessConversationRequestBody>(request);
  } catch (error) {
    return errorResponse(error);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await processConversation(body, (event) => {
          controller.enqueue(encodeEvent(event));
        });
      } catch {
        // processConversation emits the terminal failed event before rethrowing.
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
