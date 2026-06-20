import { AppShell } from "@/components/AppShell";
import { OutcomeLoop } from "@/components/OutcomeLoop";
import { getOutcomeLoopViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function TractionPage() {
  const outcomeLoop = getOutcomeLoopViewModel();

  return (
    <AppShell active="loops">
      <OutcomeLoop loop={outcomeLoop} />
    </AppShell>
  );
}
