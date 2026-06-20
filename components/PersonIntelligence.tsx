import { Edit3, Heart, MapPin, Rocket, Send, Snowflake, Timer, XCircle } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { PersonIntelligenceViewModel } from "@/lib/frontend/mockData";

export function PersonIntelligence({ person }: { person: PersonIntelligenceViewModel }) {
  return (
    <section className="screen person-screen">
      <div className="person-header">
        <Avatar initials={person.contact.initials} tone="signal" size="lg" />
        <div>
          <h1>{person.contact.name}</h1>
          <p>{person.contact.role} at {person.contact.company}</p>
          <span className="location-line">
            <MapPin size={15} />
            {person.contact.location}
          </span>
        </div>
      </div>

      <div className="signal-grid">
        <article>
          <Heart size={20} />
          <span>Warmth</span>
          <strong>{person.warmth}</strong>
        </article>
        <article>
          <Rocket size={20} />
          <span>Mission fit</span>
          <strong>{person.missionFit}</strong>
        </article>
      </div>

      <div className="system-note">
        <span>System note</span>
        <p>{person.systemNote}</p>
      </div>

      <article className="recommendation-panel">
        <div className="section-label">
          <Rocket size={17} />
          <span>Primary recommendation</span>
        </div>
        <h2>{person.recommendation.title}</h2>
        <p>{person.recommendation.reason}</p>
      </article>

      <article className="avoid-panel">
        <XCircle size={19} />
        <div>
          <strong>What to avoid</strong>
          <p>{person.recommendation.avoid}</p>
        </div>
      </article>

      <div className="draft-panel">
        <div className="draft-title">
          <span>Proposed message</span>
          <button>
            <Edit3 size={15} />
            Edit
          </button>
        </div>
        <textarea aria-label="Proposed follow-up message" defaultValue={person.recommendation.draft} />
      </div>

      <div className="manual-actions">
        <button className="primary-action">
          <Send size={17} />
          Send manually
        </button>
        <button className="secondary-action">
          <Timer size={17} />
          Wait
        </button>
        <button className="secondary-action">
          <Snowflake size={17} />
          Snooze
        </button>
      </div>
    </section>
  );
}
