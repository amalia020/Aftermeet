import { AppShell } from "@/components/AppShell";
import { MissionRadar } from "@/components/MissionRadar";
import { requireMissionUser } from "@/lib/auth/server";
import { getMissionRadarViewModelForUser } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const user = await requireMissionUser();
  const missionRadar = await getMissionRadarViewModelForUser(user.id);

  return (
    <AppShell active="radar">
      <MissionRadar radar={missionRadar} />
    </AppShell>
  );
}
