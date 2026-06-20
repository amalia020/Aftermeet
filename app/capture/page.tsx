import { AppShell } from "@/components/AppShell";
import { CaptureSignal } from "@/components/CaptureSignal";
import { captureScreen } from "@/lib/frontend/mockData";

export default function CapturePage() {
  return (
    <AppShell active="capture">
      <CaptureSignal viewModel={captureScreen} />
    </AppShell>
  );
}
