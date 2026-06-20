import { AppShell } from "@/components/AppShell";
import { RelationshipBoard } from "@/components/RelationshipBoard";
import { getRelationshipBoardViewModel } from "@/lib/frontend/viewModels";
import { requireMissionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = await requireMissionUser();
  const relationshipBoard = getRelationshipBoardViewModel(user.id);

  return (
    <AppShell active="people">
      <RelationshipBoard board={relationshipBoard} />
    </AppShell>
  );
}
