import {
  Ban,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Handshake,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { OutcomeLoopViewModel } from "@/lib/frontend/mockData";

const optionIcons = [CheckCircle2, CalendarCheck, Handshake, Briefcase, Ban, Ban];

export function OutcomeLoop({ loop }: { loop: OutcomeLoopViewModel }) {
  return (
    <section className="screen loop-screen">
      <div className="loop-hero">
        <Avatar initials={loop.contact.initials} tone="signal" size="lg" />
        <h1>{loop.prompt}</h1>
        <p>Feedback keeps the daily brief tuned to your real mission fit.</p>
      </div>

      <div className="outcome-options">
        {loop.options.map((option, index) => {
          const Icon = optionIcons[index] ?? CheckCircle2;
          return (
            <button className={`outcome-option outcome-${option.kind}`} key={option.id}>
              <Icon size={30} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="traction-strip">
        <div>
          <strong>{loop.summary.repliesReceived}</strong>
          <span>Replies</span>
        </div>
        <div>
          <strong>{loop.summary.bookedMeetings}</strong>
          <span>Booked</span>
        </div>
        <div>
          <strong>{loop.summary.actionsCompleted}</strong>
          <span>Moves logged</span>
        </div>
      </div>
      <button className="skip-button">Skip for now</button>
    </section>
  );
}
