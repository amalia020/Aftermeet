import { AppShell } from "@/components/AppShell";
import { DailyBrief } from "@/components/DailyBrief";
import { getDailyBriefViewModel } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireMissionUser();
  const dailyBrief = getDailyBriefViewModel(user.id);

  return (
    <AppShell active="today">
      <DailyBrief brief={dailyBrief} />
    </AppShell>
  );
}
