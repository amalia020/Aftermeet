import Link from "next/link";
import { ArrowUpRight, GitBranch, SlidersHorizontal } from "lucide-react";
import type { MissionRadarViewModel } from "@/lib/frontend/viewModels";

export function MissionRadar({ radar }: { radar: MissionRadarViewModel }) {
  return (
    <section className="screen radar-screen">
      <div className="screen-kicker">Mission radar</div>
      <h1>{radar.missionTitle}</h1>
      <p className="screen-intro">
        Calibrated by mission fit and timing pressure. High-right means action earns attention today.
      </p>

      <div className="radar-console">
        <div className="matrix-panel">
          <div className="axis-label axis-y">Timing pressure</div>
          <div className="axis-label axis-x">Mission fit</div>
          <div className="matrix-grid">
            <span className="quadrant quadrant-watch">Watch</span>
            <span className="quadrant quadrant-act">Act</span>
            <span className="quadrant quadrant-park">Park</span>
            <span className="quadrant quadrant-develop">Develop</span>
            {radar.nodes.map((node) => (
              <div
                className={`matrix-node matrix-node-${node.state}`}
                key={node.id}
                style={{ left: `${node.x}%`, bottom: `${node.y}%` }}
              >
                <strong>{node.initials}</strong>
                <span>{node.name}</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="signal-ledger">
          <div className="section-label">
            <SlidersHorizontal size={17} />
            <span>Signal ledger</span>
          </div>
          {radar.nodes.map((node) => {
            const content = (
              <>
                <div>
                  <strong>{node.name}</strong>
                  <span>{node.note}</span>
                </div>
                <ArrowUpRight size={16} />
              </>
            );

            return node.href ? (
              <Link className="ledger-row" href={node.href} key={node.id}>
                {content}
              </Link>
            ) : (
              <article className="ledger-row" key={node.id}>
                {content}
              </article>
            );
          })}
        </aside>
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
