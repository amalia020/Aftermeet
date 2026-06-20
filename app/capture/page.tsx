"use client";

/**
 * /capture — text capture (primary) with voice + card affordances, the
 * acceptable-use note, and the processing-cascade → decision-trace magic moment.
 * CaptureCard drives the SSE stream and falls back to the fixture replay if the
 * backend is unreachable. Renders from the FrontendMockDataset objective.
 */

import { mockDataset } from "@/lib/frontend/mock";
import { buildCaptureScreenViewModel } from "@/lib/frontend/viewModels";
import { CaptureCard } from "@/components/CaptureCard";

export default function CapturePage() {
  const viewModel = buildCaptureScreenViewModel(mockDataset.objective);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-cloud">Capture a conversation</h1>
        <p className="mt-1 text-sm text-cloud-dim">
          Write what was said. AfterMeet turns it into facts, context, routes, and one clear next
          move — for you to review and send yourself.
        </p>
      </div>
      <CaptureCard viewModel={viewModel} />
    </div>
  );
}
