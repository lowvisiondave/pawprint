"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Workspace {
  id: number;
  name: string;
  api_key: string;
  created_at: string;
}

interface DashboardData {
  latestReport: {
    timestamp: string;
    gateway: { online: boolean; uptime: number };
    sessions: { active: number; total: number };
    crons: { enabled: number; total: number };
    costs: { today: number; month: number };
  } | null;
  reportedAt: string | null;
  gatewayOnline: boolean;
}

interface HistoryPoint {
  timestamp: string;
  gateway_online: boolean;
  sessions_active: number;
  cost_today: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-xi-khaki.vercel.app";

// Landing page (unauthenticated)
function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-6xl mb-6">🐾</div>
          <h1 className="text-5xl font-bold mb-4">PawPrint</h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto">
            Monitor your AI agents in real-time. Track sessions, cron jobs, costs, and uptime.
          </p>
        </div>

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

        <div className="text-center">
          <button
            onClick={() => signIn("github")}
            className="bg-zinc-100 text-zinc-900 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-zinc-200"
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

// Create workspace modal
function CreateWorkspaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (workspace: Workspace) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/workspace/create?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.workspace) {
        onCreated(data.workspace);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create Workspace</h2>
        <form onSubmit={handleCreate}>
          <label className="block text-sm text-zinc-400 mb-2">Workspace Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 mb-4"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Dashboard component
function Dashboard() {
  const { data: session, status } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch workspaces
  useEffect(() => {
    if (status === "authenticated") {
      fetch(`${API_URL}/api/v1/workspaces`)
        .then((res) => res.json())
        .then((data) => {
          setWorkspaces(data.workspaces || []);
          if (data.workspaces?.length > 0) {
            setSelectedWorkspace(data.workspaces[0]);
          }
        });
    }
  }, [status]);

  // Fetch dashboard data
  useEffect(() => {
    if (selectedWorkspace) {
      setLoading(true);
      Promise.all([
        fetch(`${API_URL}/api/v1/dashboard?workspace_id=${selectedWorkspace.id}`).then((r) => r.json()),
        fetch(`${API_URL}/api/v1/history?workspace_id=${selectedWorkspace.id}`).then((r) => r.json()),
      ])
        .then(([dashData, histData]) => {
          setData(dashData);
          setHistory(histData.history || []);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedWorkspace]);

  // Auto-refresh every 5 min
  useEffect(() => {
    if (!selectedWorkspace) return;
    const interval = setInterval(() => {
      Promise.all([
        fetch(`${API_URL}/api/v1/dashboard?workspace_id=${selectedWorkspace.id}`).then((r) => r.json()),
        fetch(`${API_URL}/api/v1/history?workspace_id=${selectedWorkspace.id}`).then((r) => r.json()),
      ]).then(([dashData, histData]) => {
        setData(dashData);
        setHistory(histData.history || []);
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedWorkspace]);

  function copyApiKey() {
    if (selectedWorkspace) {
      navigator.clipboard.writeText(selectedWorkspace.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Calculate uptime
  const uptimePercent = history.length > 0
    ? Math.round((history.filter((h) => h.gateway_online).length / history.length) * 100)
    : null;

  // Format chart data
  const chartData = history
    .slice()
    .reverse()
    .map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sessions: h.sessions_active,
      cost: h.cost_today,
      online: h.gateway_online ? 1 : 0,
    }));

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LandingPage />;
  }

  // No workspaces - prompt to create
  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">🐾 PawPrint</h1>
            <button
              onClick={() => signOut()}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Sign out
            </button>
          </div>

          <div className="text-center py-16">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-zinc-400 mb-6">
              Create your first workspace to start monitoring your agent.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-lg font-medium"
            >
              Create Workspace
            </button>
          </div>
        </div>

        {showCreateModal && (
          <CreateWorkspaceModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(ws) => {
              setWorkspaces([ws]);
              setSelectedWorkspace(ws);
            }}
          />
        )}
      </div>
    );
  }

  const { latestReport, reportedAt, gatewayOnline } = data || {};

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">🐾 PawPrint</h1>
            <select
              value={selectedWorkspace?.id}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === parseInt(e.target.value));
                setSelectedWorkspace(ws || null);
              }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-zinc-400 hover:text-zinc-100 text-sm"
            >
              + New
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{session?.user?.name}</span>
            <button onClick={() => signOut()} className="text-zinc-400 hover:text-zinc-100 text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6">
        {loading ? (
          <div className="text-center text-zinc-400 py-16">Loading dashboard...</div>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-sm">Gateway</div>
                <div className="text-2xl font-bold">
                  {gatewayOnline ? (
                    <span className="text-emerald-400">🟢 Online</span>
                  ) : (
                    <span className="text-red-400">🔴 Offline</span>
                  )}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-sm">Uptime (24h)</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {uptimePercent !== null ? `${uptimePercent}%` : "—"}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-sm">Active Sessions</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {latestReport?.sessions?.active ?? 0}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-sm">Cost Today</div>
                <div className="text-2xl font-bold text-emerald-400">
                  ${latestReport?.costs?.today?.toFixed(2) ?? "0.00"}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-sm">Cron Jobs</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {latestReport?.crons?.enabled ?? 0}/{latestReport?.crons?.total ?? 0}
                </div>
              </div>
            </div>

            {/* Charts */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Sessions (24h)</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }}
                        labelStyle={{ color: "#a1a1aa" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sessions"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Cost (24h)</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* API Key section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
              <div className="text-sm text-zinc-400 mb-2">Reporter API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-950 px-3 py-2 rounded font-mono text-sm">
                  {selectedWorkspace?.api_key}
                </code>
                <button onClick={copyApiKey} className="bg-zinc-800 px-3 py-2 rounded text-sm hover:bg-zinc-700">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Use this key in your reporter config: PAWPRINT_API_KEY={selectedWorkspace?.api_key}
              </p>
            </div>

            {/* Last report */}
            <div className="text-sm text-zinc-500">
              Last report: {reportedAt ? new Date(reportedAt).toLocaleString() : "Never"} •{" "}
              {history.length} readings
            </div>
          </>
        )}
      </main>

      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(ws) => {
            setWorkspaces([...workspaces, ws]);
            setSelectedWorkspace(ws);
          }}
        />
      )}
    </div>
  );
}

export default function Home() {
  return <Dashboard />;
}
