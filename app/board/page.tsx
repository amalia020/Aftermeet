import { AppShell } from "@/components/AppShell";
import { RelationshipBoard } from "@/components/RelationshipBoard";
import { getRelationshipBoardViewModel } from "@/lib/frontend/viewModels";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  const relationshipBoard = getRelationshipBoardViewModel();

  return (
    <AppShell active="board">
      <RelationshipBoard board={relationshipBoard} />
    </AppShell>
  );
}
