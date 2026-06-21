import { isSupabaseConfigured } from "@/lib/auth/config";

export function shouldUseSupabaseDatabase(): boolean {
  return isSupabaseConfigured();
}
