"use client";

/**
 * /contacts/[id] — one person in full: identity, conversation atoms, public
 * context + source register, decision trace + draft, and follow-up history.
 *
 * The demo dataset has a complete record for the primary contact; peer contacts
 * (board-only) render a calm minimal record rather than inventing data.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { mockDataset } from "@/lib/frontend/mock";
import {
  buildPersonViewModel,
  boardCardsFromDataset,
  humanizeAction,
} from "@/lib/frontend/viewModels";
import { PersonView } from "@/components/PersonView";
import { Panel, Pill, EmptyState } from "@/components/primitives";
import { WarmthDecayBar } from "@/components/WarmthDecayBar";
import { DemoBadge } from "@/components/AppShell";

export default function PersonPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(
    Array.isArray(params.id) ? params.id[0] : params.id ?? "",
  );

  const primaryId = mockDataset.recommendationPackage.boardCard.contactId;
  const isPrimary = id === primaryId;

  const backLink = (
    <Link
      href="/contacts"
      className="inline-block text-xs text-signal-calm hover:underline"
    >
      ← All contacts
    </Link>
  );

  if (isPrimary) {
    const viewModel = buildPersonViewModel({
      contactId: id,
      recommendationPackage: mockDataset.recommendationPackage,
      evidenceBundle: mockDataset.evidenceBundle,
    });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {backLink}
          <DemoBadge />
        </div>
        <PersonView
          viewModel={viewModel}
          handoff={mockDataset.extractionHandoff}
          history={[]}
        />
      </div>
    );
  }

  // Peer contact: render the calm minimal record from its board card only.
  const card = boardCardsFromDataset(mockDataset).find((c) => c.contactId === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {backLink}
        <DemoBadge />
      </div>
      {card ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-5">
            <h1 className="text-xl font-semibold text-cloud">
              {card.contactName ?? "Unnamed contact"}
            </h1>
            {card.company ? (
              <p className="mt-0.5 text-sm text-cloud-dim">{card.company}</p>
            ) : null}
          </div>
          <Panel title="Status" subtitle="This contact's current state">
            <div className="mb-3 flex items-center gap-2">
              <Pill>{card.status}</Pill>
              <Pill tone="calm">{humanizeAction(card.recommendedAction)}</Pill>
            </div>
            <WarmthDecayBar
              warmth={card.warmthScore}
              warning={card.warning && card.status !== "booked"}
              warningReason={card.warningReason}
            />
          </Panel>
          <p className="text-xs text-cloud-faint">
            Full conversation atoms, public context, and the decision trace appear here once this
            contact's conversation is processed.
          </p>
        </div>
      ) : (
        <EmptyState
          title="Contact not found"
          body="This contact isn't in the demo dataset."
          action={
            <Link
              href="/contacts"
              className="rounded-md bg-cloud px-3 py-1.5 text-sm font-medium text-ink hover:bg-white"
            >
              Back to contacts
            </Link>
          }
        />
      )}
    </div>
  );
}
