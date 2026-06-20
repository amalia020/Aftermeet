"use client";

/**
 * AppShell (Part 4) — global navigation, layout chrome, active objective, and
 * demo-mode badge. Wraps every route. The first screen is the usable app, not a
 * landing page.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavigationItem, UserObjectiveProfile } from "@/lib/types";
import { humanizeGoal } from "@/lib/frontend/viewModels";
import { getObjective } from "@/lib/frontend/apiClient";
import { part1DemoObjective } from "@/lib/demo/savedExamples";

export interface AppShellProps {
  navigation?: NavigationItem[];
  activeObjective?: UserObjectiveProfile;
  demoMode?: boolean;
  children: React.ReactNode;
}

export const DEFAULT_NAVIGATION: NavigationItem[] = [
  { route: "/", label: "Dashboard", isPrimary: true },
  { route: "/capture", label: "Capture", isPrimary: true },
  { route: "/contacts", label: "Contacts" },
  { route: "/board", label: "Board" },
  { route: "/terminal", label: "Terminal" },
  { route: "/traction", label: "Traction" },
];

function isActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-signal-warm/40 bg-signal-warm/10 px-2.5 py-0.5 text-[11px] font-medium text-signal-warm"
      title="This view is rendered from saved fixture data and works with zero API keys."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-signal-warm" aria-hidden />
      {label}
    </span>
  );
}

export function AppShell({
  navigation = DEFAULT_NAVIGATION,
  activeObjective: activeObjectiveProp,
  demoMode: demoModeProp,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? "/";

  // Self-hydrate the active objective. Falls back to the demo objective + demo
  // badge so the shell is always populated even with zero API keys.
  const [activeObjective, setActiveObjective] = useState<UserObjectiveProfile | undefined>(
    activeObjectiveProp,
  );
  const [demoMode, setDemoMode] = useState<boolean>(demoModeProp ?? true);

  useEffect(() => {
    if (activeObjectiveProp) return;
    let cancelled = false;
    void getObjective().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setActiveObjective(result.data);
        setDemoMode(false);
      } else {
        setActiveObjective(part1DemoObjective);
        setDemoMode(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeObjectiveProp]);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-cloud">
      <header className="sticky top-0 z-30 border-b border-ink-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-mono text-sm tracking-tight">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-cloud text-ink font-bold">
                A
              </span>
              <span className="font-semibold">AfterMeet</span>
              <span className="hidden text-cloud-faint sm:inline">/ decision terminal</span>
            </Link>
            <div className="flex items-center gap-3">
              {demoMode ? <DemoBadge /> : null}
              <Link
                href="/capture"
                className="rounded-md bg-cloud px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cloud"
              >
                Capture
              </Link>
            </div>
          </div>

          <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
            {navigation.map((item) => {
              const active = isActive(pathname, item.route);
              return (
                <Link
                  key={item.route}
                  href={item.route}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-calm",
                    active
                      ? "bg-ink-soft text-cloud"
                      : "text-cloud-dim hover:bg-ink-soft/60 hover:text-cloud",
                  ].join(" ")}
                >
                  {item.label}
                  {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-signal-calm/20 px-1.5 text-[11px] text-signal-calm">
                      {item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {activeObjective ? (
          <div className="border-t border-ink-line/60 bg-ink-soft/40">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-xs text-cloud-dim sm:px-6">
              <span>
                <span className="text-cloud-faint">Mission </span>
                <span className="text-cloud capitalize">{activeObjective.role}</span>
              </span>
              <span aria-hidden className="text-cloud-faint">·</span>
              <span>
                <span className="text-cloud-faint">Goal </span>
                <span className="text-cloud">{humanizeGoal(activeObjective.primaryGoal)}</span>
              </span>
              {activeObjective.eventContext ? (
                <>
                  <span aria-hidden className="text-cloud-faint">·</span>
                  <span>
                    <span className="text-cloud-faint">Event </span>
                    <span className="text-cloud">{activeObjective.eventContext}</span>
                  </span>
                </>
              ) : null}
              <span aria-hidden className="text-cloud-faint">·</span>
              <span>
                <span className="text-cloud-faint">Attention budget </span>
                <span className="text-cloud">{activeObjective.attentionBudgetToday}</span>
              </span>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-ink-line px-4 py-4 text-center text-xs text-cloud-faint sm:px-6">
        AfterMeet drafts follow-ups for you to review. Nothing is ever sent automatically.
      </footer>
    </div>
  );
}
