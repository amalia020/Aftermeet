import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "AfterMeet — Relationship Intelligence",
  description:
    "Goal-conditioned relationship intelligence for high-density networking events.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-cloud antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
