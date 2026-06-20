"use client";

/**
 * /board — the follow-up board with status columns New / Drafted / Sent / Reply /
 * Booked, a WarmthDecayBar per card, and rare warning flags. Calm by default;
 * manual outcome actions advance cards. Renders from the FrontendMockDataset.
 */

import { mockDataset, USE_MOCK } from "@/lib/frontend/mock";
import {
  boardCardsFromDataset,
  buildFollowUpBoardViewModel,
} from "@/lib/frontend/viewModels";
import { FollowUpBoard } from "@/components/FollowUpBoard";
import { DemoBadge } from "@/components/AppShell";

export default function BoardPage() {
  const cards = boardCardsFromDataset(mockDataset);
  const viewModel = buildFollowUpBoardViewModel(cards);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cloud">Follow-up board</h1>
          <p className="mt-1 text-sm text-cloud-dim">
            New → Drafted → Sent → Reply → Booked. Warnings only when something's genuinely going
            cold.
          </p>
        </div>
        {USE_MOCK ? <DemoBadge /> : null}
      </div>
      <FollowUpBoard viewModel={viewModel} demoMode={USE_MOCK} />
    </div>
  );
}
