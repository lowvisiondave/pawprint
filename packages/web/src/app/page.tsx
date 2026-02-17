"use client";

import { useEffect, useState } from "react";

interface Session {
  key: string;
  kind: "direct" | "group";
  model: string;
  tokensUsed: number;
  tokensMax: number;
  lastActivity: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: "ok" | "error";
  nextRunAt?: string;
  consecutiveErrors: number;
}

interface DashboardData {
  latestReport: {
    sessions: Session[];
    crons: CronJob[];
    timestamp: string;
    agentId: string;
  } | null;
  reportedAt: string | null;
  gatewayOnline: boolean;
}

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "demo-key";

// Use relative URL for same-origin (Vercel deployment)
// Use absolute URL for local development
const API_URL = process.env.NEXT_PUBLIC_API_URL || ""; // empty = same origin

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`${API_URL}/api/v1/dashboard`, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex">
        <aside className="w-64 border-r border-zinc-800 p-4">
          <h1 className="text-xl font-bold text-zinc-100 mb-8">🐾 PawPrint</h1>
        </aside>
        <main className="flex-1 p-6">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
            {error || "No data received"}
          </div>
        </main>
      </div>
    );
  }

  const { latestReport, reportedAt, gatewayOnline } = data;
  const sessions = latestReport?.sessions || [];
  const crons = latestReport?.crons || [];

  // Calculate stats
  const totalTokens = sessions.reduce((sum, s) => sum + s.tokensUsed, 0);
  const activeSessions = sessions.filter(
    (s) => Date.now() - new Date(s.lastActivity).getTime() < 30 * 60 * 1000
  ).length;
  const cronErrors = crons.filter((c) => c.lastStatus === "error").length;
  const enabledCrons = crons.filter((c) => c.enabled).length;

  // Estimate cost (rough approximation)
  const estimatedCost = (totalTokens / 1_000_000) * 3; // ~$3/M tokens

  function formatTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hrs ago`;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 p-4">
        <h1 className="text-xl font-bold text-zinc-100 mb-8">🐾 PawPrint</h1>
        <nav className="space-y-2">
          <a href="#" className="block px-3 py-2 rounded bg-zinc-800 text-zinc-100">
            Dashboard
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Sessions
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Cron Jobs
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Costs
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Errors
          </a>
        </nav>
        <div className="mt-8 pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500">
            <div>Gateway: {gatewayOnline ? "🟢 Online" : "🔴 Offline"}</div>
            <div>Last report: {reportedAt ? formatTime(reportedAt) : "Never"}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        {/* Status cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Active Sessions</div>
            <div className="text-2xl font-bold text-zinc-100">{activeSessions}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Cron Jobs</div>
            <div className="text-2xl font-bold text-zinc-100">
              {enabledCrons}/{crons.length}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Tokens (est)</div>
            <div className="text-2xl font-bold text-emerald-400">
              {totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Errors (24h)</div>
            <div className="text-2xl font-bold text-red-400">{cronErrors}</div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <div className="text-zinc-500">No sessions yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left py-2">Agent</th>
                  <th className="text-left py-2">Model</th>
                  <th className="text-left py-2">Tokens</th>
                  <th className="text-left py-2">Started</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {sessions.slice(0, 10).map((session) => (
                  <tr key={session.key} className="border-b border-zinc-800">
                    <td className="py-2">{session.key}</td>
                    <td className="py-2">{session.model}</td>
                    <td className="py-2">{session.tokensUsed.toLocaleString()}</td>
                    <td className="py-2">{formatTime(session.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cron jobs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Cron Jobs</h2>
          {crons.length === 0 ? (
            <div className="text-zinc-500">No cron jobs configured</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Schedule</th>
                  <th className="text-left py-2">Last Run</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {crons.map((cron) => (
                  <tr key={cron.id} className="border-b border-zinc-800">
                    <td className="py-2">{cron.name}</td>
                    <td className="py-2">{cron.schedule}</td>
                    <td className="py-2">
                      {cron.lastRunAt ? formatTime(cron.lastRunAt) : "Never"}
                    </td>
                    <td className="py-2">
                      {cron.lastStatus === "error" ? (
                        <span className="text-red-400">Error</span>
                      ) : cron.lastStatus === "ok" ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
