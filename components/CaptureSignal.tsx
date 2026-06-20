import { Mic, Radio, ScanLine } from "lucide-react";
import type { CaptureScreenViewModel } from "@/lib/types";

export function CaptureSignal({ viewModel }: { viewModel: CaptureScreenViewModel }) {
  return (
    <section className="screen capture-screen">
      <div className="capture-topline">
        <span className="user-orb user-orb-large">AM</span>
        <span className="capture-mode">Field note</span>
      </div>
      <div className="capture-composer">
        <div>
          <div className="screen-kicker">Recruit Core Talent</div>
          <h1>Add relationship signal</h1>
        </div>
        <textarea
          aria-label="Relationship note"
          defaultValue=""
          placeholder="Met Elena after the AI infra panel. She is scaling distributed systems, open to technical conversations..."
        />
        <div className="capture-actions">
          <button aria-label="Record voice note" className="round-tool">
            <Mic size={24} />
          </button>
          <button aria-label="Scan card" className="round-tool">
            <ScanLine size={23} />
          </button>
          <button className="primary-action capture-submit">
            <Radio size={18} />
            <span>Analyze relationship</span>
          </button>
        </div>
        <p className="quiet-note">{viewModel.acceptableUseText}</p>
      </div>
    </section>
  );
}
