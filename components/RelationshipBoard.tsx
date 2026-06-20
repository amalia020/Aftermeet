"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Copy,
  Flame,
  Hourglass,
  Moon,
  Send,
  Sparkle,
  Zap,
} from "lucide-react";
import type {
  BoardCard,
  BoardSection,
  RelationshipBoardViewModel,
} from "@/lib/frontend/viewModels";

const sectionIcons: Record<BoardSection["tone"], React.ComponentType<{ size?: number }>> = {
  urgent: Zap,
  warm: Flame,
  waiting: Hourglass,
  cooling: Sparkle,
  dormant: Moon,
};

async function recordSent(card: BoardCard) {
  if (!card.contactId) return;
  await fetch("/api/outcomes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "user_demo",
      contactId: card.contactId,
      recommendationId: card.recommendationId,
      outcomeType: "sent",
    }),
  });
}

export function RelationshipBoard({ board }: { board: RelationshipBoardViewModel }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const copyDraft = async (card: BoardCard) => {
    const text = card.draftBody ?? card.note;
    await navigator.clipboard.writeText(text);
    setCopiedId(card.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const markSent = async (card: BoardCard) => {
    setBusyId(card.id);
    try {
      await recordSent(card);
      setSentIds((existing) => new Set(existing).add(card.id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="screen board-screen">
      <div className="screen-kicker">Relationship board</div>
      <h1>Strategic queue</h1>
      <p className="screen-intro">
        Organized by timing and mission relevance, so the next move does not fade.
      </p>

      {board.sections.map((section) => {
        const Icon = sectionIcons[section.tone];
        return (
          <section className={`board-section board-${section.tone}`} key={section.id}>
            <div className="board-section-title">
              <span>
                <Icon size={18} />
                {section.title}
              </span>
              <small>{section.context}</small>
            </div>
            {section.cards.length === 0 ? (
              <div className="empty-state">No relationships currently in this lane.</div>
            ) : (
              <div className="board-card-stack">
                {section.cards.map((card) => {
                  const sent = sentIds.has(card.id);
                  return (
                    <article className="relationship-card" key={card.id}>
                      <div className="relationship-card-top">
                        <div>
                          {card.href ? (
                            <Link href={card.href}>
                              <strong>{card.name}</strong>
                            </Link>
                          ) : (
                            <strong>{card.name}</strong>
                          )}
                          <span>{card.role}</span>
                        </div>
                        <span className="mini-pill">{card.label}</span>
                      </div>
                      <p>{card.note}</p>
                      {card.whatToAvoid ? (
                        <small className="board-avoid">Avoid: {card.whatToAvoid}</small>
                      ) : null}
                      <div className="draft-controls">
                        <button disabled={busyId === card.id} onClick={() => copyDraft(card)}>
                          {copiedId === card.id ? <Check size={15} /> : <Copy size={15} />}
                          {copiedId === card.id ? "Copied" : "Copy draft"}
                        </button>
                        <button
                          disabled={card.disabled || sent || busyId === card.id}
                          onClick={() => markSent(card)}
                        >
                          {sent ? <Check size={15} /> : <Send size={15} />}
                          {sent ? "Sent" : "Mark sent"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
