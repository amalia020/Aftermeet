import { AppShell } from "@/components/AppShell";
import { DailyBrief } from "@/components/DailyBrief";
import { requireMissionUser } from "@/lib/auth/server";
import { getDailyBriefViewModelForUser } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireMissionUser();
  const dailyBrief = await getDailyBriefViewModelForUser(user.id);

  return (
    <AppShell active="today">
      <DailyBrief brief={dailyBrief} />
    </AppShell>
  );
}
