import { AppShell } from "@/components/AppShell";
import { CaptureSignal } from "@/components/CaptureSignal";
import { getCaptureScreenViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function CapturePage() {
  const captureScreen = getCaptureScreenViewModel();

  return (
    <AppShell active="capture">
      <CaptureSignal viewModel={captureScreen} />
    </AppShell>
  );
}
