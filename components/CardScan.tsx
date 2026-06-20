"use client";

/**
 * CardScan (Part 4) — business-card capture affordance with a manual text
 * fallback. If OCR is unavailable, the user types the card details, which flow
 * through the same text capture path. Never blocks text.
 */

import { useState } from "react";

export interface CardScanProps {
  onCardText: (text: string) => void;
  disabled?: boolean;
}

export function CardScan({ onCardText, disabled }: CardScanProps) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");

  const handleFile = (file: File | null) => {
    if (!file) return;
    // Live build: POST to /api/capture/card for OCR. Here we surface a manual
    // fallback prompt so the demo always has a path forward.
    setOpen(true);
    onCardText(
      `Business card "${file.name}" added. Add any extra context from the conversation, then process.`,
    );
  };

  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cloud">Business card</p>
          <p className="text-xs text-cloud-faint">
            Scan a card, or type the details if scanning is unavailable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            className={`cursor-pointer rounded-md bg-ink-soft px-3 py-1.5 text-sm font-medium text-cloud transition hover:bg-ink-line focus-within:ring-2 focus-within:ring-signal-calm ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            Scan
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={disabled}
            className="rounded-md px-3 py-1.5 text-sm text-cloud-dim transition hover:text-cloud disabled:opacity-50"
          >
            Type instead
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3">
          <label htmlFor="card-manual" className="sr-only">
            Card details
          </label>
          <textarea
            id="card-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={2}
            placeholder="Name, role, company, email…"
            className="w-full rounded-md border border-ink-line bg-ink px-3 py-2 text-sm text-cloud placeholder:text-cloud-faint focus:border-signal-calm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (manual.trim()) onCardText(manual.trim());
            }}
            className="mt-2 rounded-md bg-ink-soft px-3 py-1 text-xs font-medium text-cloud hover:bg-ink-line"
          >
            Use card details
          </button>
        </div>
      ) : null}
    </div>
  );
}
