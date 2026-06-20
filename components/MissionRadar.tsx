import { GitBranch, RadioTower } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { MissionRadarViewModel, RadarNode } from "@/lib/frontend/mockData";

function nodeTone(state: RadarNode["state"]) {
  if (state === "action") return "signal";
  if (state === "cooling") return "warm";
  if (state === "waiting") return "muted";
  return "cool";
}

export function MissionRadar({ radar }: { radar: MissionRadarViewModel }) {
  return (
    <section className="screen radar-screen">
      <div className="screen-kicker">Mission radar</div>
      <h1>Recruit Core Talent</h1>
      <p className="screen-intro">
        Relationships positioned by mission relevance, timing, and next useful move.
      </p>

      <div className="radar-stage">
        <div className="radar-ring ring-outer" />
        <div className="radar-ring ring-middle" />
        <div className="radar-ring ring-inner" />
        <div className="radar-center">
          <RadioTower size={20} />
          <strong>Mission</strong>
          <span>Senior infra</span>
        </div>
        {radar.nodes.map((node) => (
          <div
            className={`radar-node radar-node-${node.state}`}
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <Avatar initials={node.initials} tone={nodeTone(node.state)} size="sm" />
            <span>{node.name}</span>
          </div>
        ))}
      </div>

      <div className="radar-legend">
        <span><i className="dot dot-action" /> Best move</span>
        <span><i className="dot dot-warm" /> Warm</span>
        <span><i className="dot dot-cooling" /> Cooling</span>
        <span><i className="dot dot-waiting" /> Wait</span>
      </div>

      <div className="bridge-list">
        <div className="section-label">
          <GitBranch size={17} />
          <span>Possible bridges</span>
        </div>
        {radar.bridges.map((bridge) => (
          <article className="bridge-card" key={`${bridge.from}-${bridge.to}`}>
            <span>{bridge.from}</span>
            <strong>{bridge.label}</strong>
            <span>{bridge.to}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
