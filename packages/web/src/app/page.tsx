"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Landing page component
function LandingPage({ 
  onSubmit, 
  loading 
}: { 
  onSubmit: (apiKey: string) => void,
  loading: boolean 
}) {
  const [apiKey, setApiKey] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey.trim());
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-6xl mb-6">🐾</div>
          <h1 className="text-5xl font-bold mb-4">PawPrint</h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto">
            Monitor your OpenClaw agents in real-time. Track sessions, cron jobs, and token usage.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold mb-2">Session Tracking</h3>
            <p className="text-zinc-400 text-sm">
              Monitor active sessions, see token usage, and track model performance in real-time.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-3xl mb-3">⏰</div>
            <h3 className="text-lg font-semibold mb-2">Cron Monitoring</h3>
            <p className="text-zinc-400 text-sm">
              Keep tabs on scheduled jobs, see last run status, and catch errors before they snowball.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-lg font-semibold mb-2">Cost Insights</h3>
            <p className="text-zinc-400 text-sm">
              Track token usage and estimate costs. Know exactly what your agents are spending.
            </p>
          </div>
        </div>

        {/* Login form */}
        <div className="max-w-md mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Connect Your Agent</h2>
            <form onSubmit={handleSubmit}>
              <label htmlFor="apiKey" className="block text-sm text-zinc-400 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !apiKey.trim()}
                  className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "..." : "Go"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Your API key is stored locally and never sent to our servers.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dashboard component (existing code)
function Dashboard({ 
  apiKey, 
  onLogout 
}: { 
  apiKey: string,
  onLogout: () => void
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`${API_URL}/api/v1/dashboard`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [apiKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  const { latestReport, reportedAt, gatewayOnline } = data || {};
  const sessions = latestReport?.sessions || [];
  const crons = latestReport?.crons || [];

  const totalTokens = sessions.reduce((sum, s) => sum + s.tokensUsed, 0);
  const activeSessions = sessions.filter(
    (s) => Date.now() - new Date(s.lastActivity).getTime() < 30 * 60 * 1000
  ).length;
  const cronErrors = crons.filter((c) => c.lastStatus === "error").length;
  const enabledCrons = crons.filter((c) => c.enabled).length;

  function formatTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hrs ago`;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div className="min-h-screen flex">
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
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <button 
            onClick={onLogout}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
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

export default function Home() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    // Check for stored API key on mount
    const stored = localStorage.getItem("pawprint_api_key");
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  function handleLogin(key: string) {
    setLoggingIn(true);
    localStorage.setItem("pawprint_api_key", key);
    setApiKey(key);
    setLoggingIn(false);
  }

  function handleLogout() {
    localStorage.removeItem("pawprint_api_key");
    setApiKey(null);
  }

  if (!apiKey) {
    return <LandingPage onSubmit={handleLogin} loading={loggingIn} />;
  }

  return <Dashboard apiKey={apiKey} onLogout={handleLogout} />;
}
