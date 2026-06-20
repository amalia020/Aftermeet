"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/auth/config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase public env is not configured.");
  }
  return createBrowserClient(url, anonKey);
}
