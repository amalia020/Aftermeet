import { AppShell } from "@/components/AppShell";
import { MissionRadar } from "@/components/MissionRadar";
import { missionRadar } from "@/lib/frontend/mockData";

export default function TerminalPage() {
  return (
    <AppShell active="radar">
      <MissionRadar radar={missionRadar} />
    </AppShell>
  );
}
