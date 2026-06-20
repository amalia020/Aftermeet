"use client";

/**
 * /traction — proof metrics first: replies, booked meetings, WTP, and paid
 * commitments, plus reply rate by opportunity type. Vanity counts (captures,
 * sign-ups) are kept secondary. Renders from the FrontendMockDataset.
 */

import { mockDataset, USE_MOCK } from "@/lib/frontend/mock";
import {
  buildTractionViewModel,
  tractionFromDataset,
} from "@/lib/frontend/viewModels";
import { TractionView } from "@/components/TractionView";
import { DemoBadge } from "@/components/AppShell";

export default function TractionPage() {
  const summary = tractionFromDataset(mockDataset);
  const viewModel = buildTractionViewModel(summary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cloud">Traction</h1>
          <p className="mt-1 text-sm text-cloud-dim">
            Proof the relationship work is paying off — not how busy you've been.
          </p>
        </div>
        {USE_MOCK ? <DemoBadge /> : null}
      </div>
      <TractionView viewModel={viewModel} />
    </div>
  );
}
