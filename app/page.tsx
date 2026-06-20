import { AppShell } from "@/components/AppShell";
import { DailyBrief } from "@/components/DailyBrief";
import { getDailyBriefViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function Home() {
  const dailyBrief = getDailyBriefViewModel();

  return (
    <AppShell active="brief">
      <DailyBrief brief={dailyBrief} />
    </AppShell>
  );
}
