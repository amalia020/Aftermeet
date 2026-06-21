import { AppShell } from "@/components/AppShell";
import { CaptureSignal } from "@/components/CaptureSignal";
import { getCaptureScreenViewModelForUser } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const user = await requireMissionUser();
  const captureScreen = await getCaptureScreenViewModelForUser(user.id);

  return (
    <AppShell active="capture">
      <CaptureSignal viewModel={captureScreen} />
    </AppShell>
  );
}
