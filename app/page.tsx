import { redirect } from "next/navigation";
import { getRootDestination } from "@/lib/frontend/onboarding";

export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect(getRootDestination());
}
