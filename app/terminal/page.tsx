import { AppShell } from "@/components/AppShell";
import { MissionRadar } from "@/components/MissionRadar";
import { getMissionRadarViewModel } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const user = await requireMissionUser();
  const missionRadar = getMissionRadarViewModel(user.id);

  return (
    <AppShell active="people">
      <MissionRadar radar={missionRadar} />
    </AppShell>
  );
}
