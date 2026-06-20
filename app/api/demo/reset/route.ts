/**
 * Demo reset (Part 1, Phase 25). Wipes and re-seeds the in-memory store so the
 * demo can be run repeatedly from a clean state.
 */

import { NextResponse } from "next/server";
import { resetStore } from "@/lib/db/client";

export const runtime = "nodejs";

export async function POST() {
  resetStore();
  return NextResponse.json({ ok: true });
}
