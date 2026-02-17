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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>
      
      <div className="relative max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-6xl mb-6 animate-in zoom-in duration-500">🐾</div>
          <h1 className="text-5xl font-bold mb-4 text-wrap balance bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            PawPrint
          </h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto text-wrap balance">
            Monitor your AI agents in real-time. Track sessions, cron jobs, costs, and uptime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-800/50">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold mb-2">Session Tracking</h3>
            <p className="text-zinc-400 text-sm">
              Monitor active sessions, see token usage, and track model performance in real-time.
            </p>
          </div>
          <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-800/50">
            <div className="text-3xl mb-3">⏰</div>
            <h3 className="text-lg font-semibold mb-2">Cron Monitoring</h3>
            <p className="text-zinc-400 text-sm">
              Keep tabs on scheduled jobs, see last run status, and catch errors before they snowball.
            </p>
          </div>
          <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-800/50">
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
            className="bg-zinc-100 text-zinc-900 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-semibold mb-4">Create Workspace</h2>
        <form onSubmit={handleCreate}>
          <label htmlFor="workspace-name" className="block text-sm text-zinc-400 mb-2">
            Workspace Name
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent…"
            autoComplete="off"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:border-zinc-600 transition-all duration-150"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-zinc-200 transition-colors duration-150"
            >
              {loading ? "Creating…" : "Create"}
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [alertSettings, setAlertSettings] = useState({
    alert_cost_threshold: "",
    alert_downtime_minutes: "5",
    slack_webhook_url: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

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

  // Fetch alert settings when workspace changes
  useEffect(() => {
    if (selectedWorkspace) {
      fetch(`${API_URL}/api/v1/workspace/settings?id=${selectedWorkspace.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.workspace) {
            setAlertSettings({
              alert_cost_threshold: data.workspace.alert_cost_threshold?.toString() || "",
              alert_downtime_minutes: data.workspace.alert_downtime_minutes?.toString() || "5",
              slack_webhook_url: data.workspace.slack_webhook_url || "",
            });
          }
        });
    }
  }, [selectedWorkspace]);

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

  async function saveAlertSettings() {
    if (!selectedWorkspace) return;
    setSavingSettings(true);
    try {
      await fetch(`${API_URL}/api/v1/workspace/settings?id=${selectedWorkspace.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_cost_threshold: alertSettings.alert_cost_threshold ? parseFloat(alertSettings.alert_cost_threshold) : null,
          alert_downtime_minutes: parseInt(alertSettings.alert_downtime_minutes) || 5,
          slack_webhook_url: alertSettings.slack_webhook_url || null,
        }),
      });
      // Refresh workspace data
      const res = await fetch(`${API_URL}/api/v1/workspaces`);
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      const updated = data.workspaces?.find((w: Workspace) => w.id === selectedWorkspace?.id);
      if (updated) setSelectedWorkspace(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
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
        <div className="text-zinc-400 animate-pulse">Loading…</div>
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
              className="text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
            >
              Sign out
            </button>
          </div>

          <div className="text-center py-16">
            <div className="text-4xl mb-4 animate-in zoom-in duration-500">🎉</div>
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-zinc-400 mb-6">
              Create your first workspace to start monitoring your agent.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-lg font-medium hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
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
      <header className="border-b border-zinc-800 px-6 py-4 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">🐾 PawPrint</h1>
            <div className="relative">
              <label htmlFor="workspace-select" className="sr-only">Select workspace</label>
              <select
                id="workspace-select"
                value={selectedWorkspace?.id}
                onChange={(e) => {
                  const ws = workspaces.find((w) => w.id === parseInt(e.target.value));
                  setSelectedWorkspace(ws || null);
                }}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm pr-8 focus-visible:ring-2 focus-visible:ring-zinc-400 transition-all duration-150 appearance-none cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors duration-150"
            >
              + New
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                activeTab === "dashboard" 
                  ? "bg-zinc-800 text-zinc-100" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                activeTab === "settings" 
                  ? "bg-zinc-800 text-zinc-100" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              Settings
            </button>
            <span className="text-zinc-600 mx-2">|</span>
            <span className="text-sm text-zinc-400">{session?.user?.name}</span>
            <button onClick={() => signOut()} className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors duration-150">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6">
        {loading ? (
          <div className="text-center text-zinc-400 py-16 animate-pulse">Loading…</div>
        ) : activeTab === "settings" ? (
          // Settings tab
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold mb-6">Workspace Settings</h2>
            
            {/* API Key */}
            <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 mb-4">
              <div className="text-sm text-zinc-400 mb-2">Reporter API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-950 px-3 py-2 rounded font-mono text-sm">
                  {selectedWorkspace?.api_key}
                </code>
                <button 
                  onClick={copyApiKey} 
                  className="bg-zinc-800 px-3 py-2 rounded text-sm hover:bg-zinc-700 transition-colors duration-150"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Alert Settings */}
            <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 mb-4">
              <h3 className="font-medium mb-4">🔔 Alert Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="cost-threshold" className="block text-sm text-zinc-400 mb-1">
                    Cost Threshold ($)
                  </label>
                  <input
                    id="cost-threshold"
                    type="number"
                    step="0.01"
                    value={alertSettings.alert_cost_threshold}
                    onChange={(e) => setAlertSettings({ ...alertSettings, alert_cost_threshold: e.target.value })}
                    placeholder="e.g. 10.00"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-zinc-400 transition-all duration-150"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Alert when daily cost exceeds this amount
                  </p>
                </div>

                <div>
                  <label htmlFor="downtime-threshold" className="block text-sm text-zinc-400 mb-1">
                    Downtime Threshold (minutes)
                  </label>
                  <input
                    id="downtime-threshold"
                    type="number"
                    value={alertSettings.alert_downtime_minutes}
                    onChange={(e) => setAlertSettings({ ...alertSettings, alert_downtime_minutes: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-zinc-400 transition-all duration-150"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Alert when gateway is offline for this long
                  </p>
                </div>

                <div>
                  <label htmlFor="slack-webhook" className="block text-sm text-zinc-400 mb-1">
                    Slack Webhook URL
                  </label>
                  <input
                    id="slack-webhook"
                    type="url"
                    value={alertSettings.slack_webhook_url}
                    onChange={(e) => setAlertSettings({ ...alertSettings, slack_webhook_url: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-zinc-400 transition-all duration-150"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Optional: Send alerts to Slack
                  </p>
                </div>

                <button
                  onClick={saveAlertSettings}
                  disabled={savingSettings}
                  className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-zinc-200 transition-colors duration-150"
                >
                  {savingSettings ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Dashboard tab
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 transition-all duration-150 hover:border-zinc-700">
                <div className="text-zinc-400 text-sm">Gateway</div>
                <div className="text-2xl font-bold">
                  {gatewayOnline ? (
                    <span className="text-emerald-400">🟢 Online</span>
                  ) : (
                    <span className="text-red-400">🔴 Offline</span>
                  )}
                </div>
              </div>
              <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 transition-all duration-150 hover:border-zinc-700">
                <div className="text-zinc-400 text-sm">Uptime (24h)</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {uptimePercent !== null ? `${uptimePercent}%` : "—"}
                </div>
              </div>
              <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 transition-all duration-150 hover:border-zinc-700">
                <div className="text-zinc-400 text-sm">Active Sessions</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {latestReport?.sessions?.active ?? 0}
                </div>
              </div>
              <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 transition-all duration-150 hover:border-zinc-700">
                <div className="text-zinc-400 text-sm">Cost Today</div>
                <div className="text-2xl font-bold text-emerald-400">
                  ${latestReport?.costs?.today?.toFixed(2) ?? "0.00"}
                </div>
              </div>
              <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 transition-all duration-150 hover:border-zinc-700">
                <div className="text-zinc-400 text-sm">Cron Jobs</div>
                <div className="text-2xl font-bold text-zinc-100">
                  {latestReport?.crons?.enabled ?? 0}/{latestReport?.crons?.total ?? 0}
                </div>
              </div>
            </div>

            {/* Charts */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
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
                <div className="backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Cost (24h)</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
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
