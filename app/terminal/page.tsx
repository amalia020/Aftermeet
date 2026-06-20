import { AppShell } from "@/components/AppShell";
import { MissionRadar } from "@/components/MissionRadar";
import { getMissionRadarViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function TerminalPage() {
  const missionRadar = getMissionRadarViewModel();

  return (
    <AppShell active="radar">
      <MissionRadar radar={missionRadar} />
    </AppShell>
  );
}
