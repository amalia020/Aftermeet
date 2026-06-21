import { AppShell } from "@/components/AppShell";
import { ObjectiveEditor } from "@/components/ObjectiveEditor";
import { getObjectiveViewModelForUser } from "@/lib/frontend/viewModels";
import { requireAppUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ObjectivePage() {
  const user = await requireAppUser();
  const objective = await getObjectiveViewModelForUser(user.id);

  return (
    <AppShell active="setup">
      <ObjectiveEditor objective={objective} />
    </AppShell>
  );
}
