import { AppShell } from "@/components/AppShell";
import { ObjectiveEditor } from "@/components/ObjectiveEditor";
import { requireAppUser } from "@/lib/auth/server";
import { getObjectiveViewModelForUser } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await requireAppUser();
  const objective = await getObjectiveViewModelForUser(user.id);

  return (
    <AppShell active="setup">
      <ObjectiveEditor
        objective={objective}
        kicker="Workspace setup"
        saveLabel="Save setup"
        title="Setup"
      />
    </AppShell>
  );
}
