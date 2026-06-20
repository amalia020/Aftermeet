"use client";

/**
 * /contacts — calm contact list. No human leaderboard grading; just a freshness
 * dot, name, details, and status. A rare "follow up now" flag is reserved for
 * contacts that genuinely warrant it. Renders from the FrontendMockDataset.
 */

import { mockDataset } from "@/lib/frontend/mock";
import {
  boardContactSummariesFromDataset,
  boardCardsFromDataset,
  buildContactListViewModel,
} from "@/lib/frontend/viewModels";
import { ContactList } from "@/components/ContactList";
import { DemoBadge } from "@/components/AppShell";

export default function ContactsPage() {
  const contacts = boardContactSummariesFromDataset(mockDataset);
  const viewModel = buildContactListViewModel(contacts);

  // Rare flag: only contacts whose card is flagged for attention.
  const flagged = new Set(
    boardCardsFromDataset(mockDataset)
      .filter((c) => c.warning && c.status !== "booked")
      .map((c) => c.contactId),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cloud">Contacts</h1>
          <p className="mt-1 text-sm text-cloud-dim">
            Everyone you've met, kept calm and organized — no scoreboards.
          </p>
        </div>
        <DemoBadge />
      </div>
      <ContactList viewModel={viewModel} followUpNowIds={flagged} />
    </div>
  );
}
