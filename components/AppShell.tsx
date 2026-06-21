import Link from "next/link";
import Image from "next/image";
import appIcon from "@/logo/Icon.png";
import {
  Blocks,
  ClipboardCheck,
  Radio,
  RefreshCcw,
  Search,
  Target,
} from "lucide-react";

type NavKey = "brief" | "capture" | "board" | "loops" | "setup";

interface AppShellProps {
  active: NavKey;
  children: React.ReactNode;
}

const navItems: {
  key: NavKey;
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}[] = [
  { key: "brief", href: "/", label: "Brief", icon: ClipboardCheck },
  { key: "capture", href: "/capture", label: "Capture", icon: Radio },
  { key: "board", href: "/board", label: "Board", icon: Blocks },
  { key: "loops", href: "/traction", label: "Loops", icon: RefreshCcw },
];

export function AppShell({ active, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link aria-label="Aftermeet home" className="brand-lockup" href="/">
          <Image alt="" className="brand-icon" priority src={appIcon} />
          <span>Aftermeet</span>
        </Link>
        <div className="topbar-actions">
          <Link aria-label="Edit setup" className="topbar-link" href="/objective">
            <Target size={19} />
            <span>Setup</span>
          </Link>
          <button aria-label="Search relationships" className="icon-button">
            <Search size={22} />
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <nav aria-label="Primary navigation" className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`nav-item ${isActive ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
            >
              <Icon size={22} strokeWidth={1.9} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
