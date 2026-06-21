import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aftermeet",
  description: "A daily relationship command center for mission-driven follow-up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
