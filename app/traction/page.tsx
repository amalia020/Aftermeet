import { AppShell } from "@/components/AppShell";
import { OutcomeLoop } from "@/components/OutcomeLoop";
import { getOutcomeLoopViewModel } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function TractionPage() {
  const user = await requireMissionUser();
  const outcomeLoop = getOutcomeLoopViewModel(user.id);

  return (
    <AppShell active="progress">
      <OutcomeLoop loop={outcomeLoop} />
    </AppShell>
  );
}
