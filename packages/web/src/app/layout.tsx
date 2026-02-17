import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawPrint - Agent Ops Dashboard",
  description: "Monitor your AI agents, cron jobs, and costs in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950">{children}</body>
    </html>
  );
}
