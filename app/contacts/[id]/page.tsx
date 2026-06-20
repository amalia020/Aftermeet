import { AppShell } from "@/components/AppShell";
import { PersonIntelligence } from "@/components/PersonIntelligence";
import { getPersonIntelligenceViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params;
  const personIntelligence = getPersonIntelligenceViewModel(id);

  return (
    <AppShell active="capture">
      <PersonIntelligence person={personIntelligence} />
    </AppShell>
  );
}
