"use client";

/**
 * /terminal — the opportunity terminal. Coverage mix (OpportunityMatrix),
 * coverage gaps, recommended next cluster(s), the action queue bounded by the
 * attention budget. Adapts to whatever objective is active — never "founder" by
 * default. Renders from the FrontendMockDataset.
 */

import { mockDataset, USE_MOCK } from "@/lib/frontend/mock";
import {
  boardCardsFromDataset,
  buildOpportunityTerminalViewModel,
  clusterRecommendationsFromDataset,
  humanizeGoal,
} from "@/lib/frontend/viewModels";
import { Panel } from "@/components/primitives";
import { OpportunityMatrix } from "@/components/OpportunityMatrix";
import { RecommendedGroupCard } from "@/components/RecommendedGroupCard";
import { ActionQueue } from "@/components/ActionQueue";
import { DemoBadge } from "@/components/AppShell";

export default function TerminalPage() {
  const objective = mockDataset.objective;
  const routes = mockDataset.recommendationPackage.routes;
  const boardCards = boardCardsFromDataset(mockDataset);

  const vm = buildOpportunityTerminalViewModel({ objective, routes, boardCards });
  const clusters = clusterRecommendationsFromDataset(mockDataset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cloud">Opportunity terminal</h1>
          <p className="mt-1 text-sm text-cloud-dim">
            How your conversations map onto your mission:{" "}
            <span className="text-cloud">{humanizeGoal(objective.primaryGoal)}</span>.
          </p>
        </div>
        {USE_MOCK ? <DemoBadge /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Opportunity mix" subtitle="Coverage of your goals, by average fit">
          <OpportunityMatrix opportunityMix={vm.opportunityMix} coverageGaps={vm.coverageGaps} />
        </Panel>

        <Panel title="Recommended next cluster" subtitle="Where to spend the next batch of attention">
          <div className="space-y-3">
            {clusters.map((cluster, i) => (
              <RecommendedGroupCard key={i} cluster={cluster} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Action queue" subtitle="Prioritized next moves, capped by your attention budget">
        <ActionQueue
          cards={vm.actionQueue}
          attentionBudgetRemaining={vm.attentionBudgetRemaining}
        />
      </Panel>
    </div>
  );
}
