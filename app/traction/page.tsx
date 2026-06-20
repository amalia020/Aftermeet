import { AppShell } from "@/components/AppShell";
import { OutcomeLoop } from "@/components/OutcomeLoop";
import { outcomeLoop } from "@/lib/frontend/mockData";

export default function TractionPage() {
  return (
    <AppShell active="loops">
      <OutcomeLoop loop={outcomeLoop} />
    </AppShell>
  );
}
