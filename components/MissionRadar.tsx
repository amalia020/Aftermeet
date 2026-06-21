import Link from "next/link";
import { ArrowUpRight, GitBranch, SlidersHorizontal } from "lucide-react";
import type { MissionRadarViewModel } from "@/lib/frontend/viewModels";

export function MissionRadar({ radar }: { radar: MissionRadarViewModel }) {
  return (
    <section className="screen radar-screen">
      <div className="screen-kicker">Your network</div>
      <h1>{radar.missionTitle}</h1>
      <p className="screen-intro">
        Your relationships mapped by how much they help your goal and how soon to reach out.
      </p>

      <div className="radar-console">
        <div className="matrix-panel">
          <div className="axis-label axis-y">When to act</div>
          <div className="axis-label axis-x">How much it helps</div>
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
            <span>People to focus on</span>
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
          <span>Intro paths</span>
        </div>
        {radar.bridges.map((bridge) => (
          <article className="bridge-card" key={bridge.id}>
            <span>{bridge.from}</span>
            <strong>{bridge.label}</strong>
            <span>{bridge.to}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
