import { AppShell } from "@/components/AppShell";
import { RelationshipBoard } from "@/components/RelationshipBoard";
import { relationshipBoard } from "@/lib/frontend/mockData";

export default function BoardPage() {
  return (
    <AppShell active="board">
      <RelationshipBoard board={relationshipBoard} />
    </AppShell>
  );
}
