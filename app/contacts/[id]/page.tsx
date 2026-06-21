import { AppShell } from "@/components/AppShell";
import { PersonIntelligence } from "@/components/PersonIntelligence";
import { getPersonIntelligenceViewModelForUser } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

interface PersonPageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PersonPageProps) {
  const user = await requireMissionUser();
  const { id } = await params;
  const personIntelligence = await getPersonIntelligenceViewModelForUser(id, user.id);

  return (
    <AppShell active="people">
      <PersonIntelligence person={personIntelligence} />
    </AppShell>
  );
}
