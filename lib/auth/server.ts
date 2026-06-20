import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { DEMO_USER_ID, getActiveObjective } from "@/lib/db/queries";
import { isSupabaseConfigured, getSupabasePublicConfig } from "@/lib/auth/config";

export interface AppUser {
  id: string;
  email?: string | null;
}

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies. Middleware/route handlers can.
        }
      },
    },
  });
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
  if (!getActiveObjective(user.id)) redirect("/setup");
  return user;
}
