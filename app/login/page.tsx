import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getCurrentAppUser } from "@/lib/auth/server";
import { getActiveObjectiveForUser } from "@/lib/db/store";
import { getLoginRedirectDestination } from "@/lib/frontend/onboarding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const user = await getCurrentAppUser();
    const destination = getLoginRedirectDestination({
      hasSession: Boolean(user),
      hasObjective: Boolean(user ? await getActiveObjectiveForUser(user.id) : null),
    });
    if (destination) redirect(destination);
  }

  return <LoginForm configured={configured} />;
}
