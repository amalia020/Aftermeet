import { AppShell } from "@/components/AppShell";
import { PersonIntelligence } from "@/components/PersonIntelligence";
import { personIntelligence } from "@/lib/frontend/mockData";

export default function PersonPage() {
  return (
    <AppShell active="capture">
      <PersonIntelligence person={personIntelligence} />
    </AppShell>
  );
}
