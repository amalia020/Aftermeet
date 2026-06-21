import { redirect } from "next/navigation";
import { DEMO_USER_ID } from "@/lib/db/queries";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";
import { getActiveObjectiveForUser } from "@/lib/db/store";

export interface AppUser {
  id: string;
  email?: string | null;
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) return { id: DEMO_USER_ID, email: "demo@aftermeet.local" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function requireAppUser(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireMissionUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!(await getActiveObjectiveForUser(user.id))) redirect("/setup");
  return user;
}
