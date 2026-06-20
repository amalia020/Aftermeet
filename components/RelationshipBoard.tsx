import { Copy, Edit3, Flame, Hourglass, Moon, Sparkle, Zap } from "lucide-react";
import type { BoardSection, RelationshipBoardViewModel } from "@/lib/frontend/mockData";

const sectionIcons: Record<BoardSection["tone"], React.ComponentType<{ size?: number }>> = {
  urgent: Zap,
  warm: Flame,
  waiting: Hourglass,
  cooling: Sparkle,
  dormant: Moon,
};

export function RelationshipBoard({ board }: { board: RelationshipBoardViewModel }) {
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
              <div className="empty-state">No critical dormant relationships currently flagged for revival.</div>
            ) : (
              <div className="board-card-stack">
                {section.cards.map((card) => (
                  <article className="relationship-card" key={card.id}>
                    <div className="relationship-card-top">
                      <div>
                        <strong>{card.name}</strong>
                        <span>{card.role}</span>
                      </div>
                      <span className="mini-pill">{card.label}</span>
                    </div>
                    <p>{card.note}</p>
                    <div className="draft-controls">
                      <button disabled={card.disabled}>
                        <Copy size={15} />
                        Copy draft
                      </button>
                      <button disabled={card.disabled}>
                        <Edit3 size={15} />
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
