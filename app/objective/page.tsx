import { AppShell } from "@/components/AppShell";
import { ObjectiveEditor } from "@/components/ObjectiveEditor";
import { getObjectiveViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function ObjectivePage() {
  const objective = getObjectiveViewModel();

  return (
    <AppShell active="mission">
      <ObjectiveEditor objective={objective} />
    </AppShell>
  );
}
