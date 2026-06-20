import { AppShell } from "@/components/AppShell";
import { DailyBrief } from "@/components/DailyBrief";
import { dailyBrief } from "@/lib/frontend/mockData";

export default function Home() {
  return (
    <AppShell active="brief">
      <DailyBrief brief={dailyBrief} />
    </AppShell>
  );
}
