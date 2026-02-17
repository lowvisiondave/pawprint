"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Workspace {
  id: number;
  name: string;
  api_key: string;
}

interface DashboardData {
  latestReport: {
    timestamp: string;
    gateway: { online: boolean; uptime: number };
    sessions: { active: number; total: number };
    crons: { enabled: number; total: number };
    costs: { today: number; month: number };
    tokens?: { input: number; output: number };
    modelBreakdown?: Record<string, number>;
    system?: {
      hostname?: string;
      memoryUsedPercent?: number;
      memoryFreeMb?: number;
      diskUsedPercent?: number;
      diskFreeGb?: number;
      localIp?: string;
    };
  } | null;
  history?: Array<{ timestamp: string; cost_today: number; sessions_active: number }>;
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

// Landing page component
function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-emerald-600/10 rounded-full blur-[96px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              PawPrint
            </span>
          </div>
          <button
            onClick={() => signIn("github")}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Sign In
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="text-center mb-12 max-w-2xl">
            <div className="text-6xl mb-6 animate-[bounce_3s_infinite]">🐾</div>
            <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Agent Ops Dashboard
            </h1>
            <p className="text-xl text-zinc-400 mb-8">
              Monitor your AI agents in real-time. Track sessions, cron jobs, costs, and system health.
            </p>
            <button
              onClick={() => signIn("github")}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-violet-600 transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25"
            >
              Get Started — It's Free
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
            {[
              { icon: "📊", title: "Real-time Metrics", desc: "Sessions, tokens, costs" },
              { icon: "🔔", title: "Smart Alerts", desc: "Cost thresholds & downtime" },
              { icon: "🖥️", title: "System Health", desc: "Memory, disk, network" },
            ].map((item, i) => (
              <div
                key={i}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-1"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                <p className="text-zinc-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// Authenticated dashboard
function AuthDashboard({ data, workspaceId }: { data: DashboardData; workspaceId: string }) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"dashboard" | "alerts" | "settings" | "install">("dashboard");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/history?workspace_id=${workspaceId}&hours=24`)
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const latestReport = data?.latestReport;
  const isOnline = data?.gatewayOnline;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-sm bg-zinc-950/50 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🐾</span>
              <span className="text-xl font-bold">PawPrint</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {isOnline ? "● Online" : "○ Offline"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400 hidden sm:block">{session?.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex gap-1 overflow-x-auto">
              {[
                { id: "dashboard", label: "Dashboard", icon: "📊" },
                { id: "alerts", label: "Alerts", icon: "🔔" },
                { id: "settings", label: "Settings", icon: "⚙️" },
                { id: "install", label: "Install", icon: "📥" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Today's Cost",
                    value: `$${latestReport?.costs?.today?.toFixed(2) || "0.00"}`,
                    icon: "💰",
                    color: "from-emerald-500/20 to-emerald-500/5",
                  },
                  {
                    label: "Active Sessions",
                    value: latestReport?.sessions?.active || 0,
                    icon: "💬",
                    color: "from-blue-500/20 to-blue-500/5",
                  },
                  {
                    label: "Total Sessions",
                    value: latestReport?.sessions?.total || 0,
                    icon: "📈",
                    color: "from-violet-500/20 to-violet-500/5",
                  },
                  {
                    label: "Monthly Cost",
                    value: `$${latestReport?.costs?.month?.toFixed(2) || "0.00"}`,
                    icon: "📅",
                    color: "from-amber-500/20 to-amber-500/5",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="backdrop-blur-xl bg-gradient-to-br border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-500 text-sm">{stat.label}</span>
                      <span className="text-xl">{stat.icon}</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* System Health Card */}
              {latestReport?.system?.hostname && (
                <div className="backdrop-blur-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">🖥️</span>
                    <span className="font-semibold">System Health</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 rounded-xl p-3">
                      <div className="text-xs text-zinc-500 mb-1">Host</div>
                      <div className="font-mono text-sm truncate">{latestReport.system.hostname}</div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3">
                      <div className="text-xs text-zinc-500 mb-1">Memory</div>
                      <div className="font-semibold">
                        {latestReport.system.memoryUsedPercent}% 
                        <span className="text-zinc-500 text-xs ml-1">({latestReport.system.memoryFreeMb}MB free)</span>
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3">
                      <div className="text-xs text-zinc-500 mb-1">Disk</div>
                      <div className="font-semibold">
                        {latestReport.system.diskUsedPercent}%
                        <span className="text-zinc-500 text-xs ml-1">({latestReport.system.diskFreeGb}GB free)</span>
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3">
                      <div className="text-xs text-zinc-500 mb-1">IP</div>
                      <div className="font-mono text-sm">{latestReport.system.localIp}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Cost Chart */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-semibold mb-4">💰 Cost (24h)</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={formatTime}
                          stroke="#71717a" 
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: "rgba(24,24,27,0.95)", 
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            backdropFilter: "blur(10px)"
                          }}
                          labelFormatter={formatTime}
                          formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cost_today" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sessions Chart */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-semibold mb-4">💬 Sessions (24h)</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={formatTime}
                          stroke="#71717a" 
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis stroke="#71717a" fontSize={12} tickLine={false} />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: "rgba(24,24,27,0.95)", 
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            backdropFilter: "blur(10px)"
                          }}
                          labelFormatter={formatTime}
                          formatter={(v: number) => [v, "Sessions"]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="sessions_active" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Token & Model Breakdown */}
              {(latestReport?.tokens || latestReport?.modelBreakdown) && (
                <div className="grid lg:grid-cols-2 gap-6">
                  {latestReport?.tokens && (
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="font-semibold mb-4">🔤 Tokens Today</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 rounded-xl p-4">
                          <div className="text-zinc-500 text-sm mb-1">Input</div>
                          <div className="text-xl font-bold text-blue-400">
                            {(latestReport.tokens.input / 1000).toFixed(1)}K
                          </div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-xl p-4">
                          <div className="text-zinc-500 text-sm mb-1">Output</div>
                          <div className="text-xl font-bold text-violet-400">
                            {(latestReport.tokens.output / 1000).toFixed(1)}K
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {latestReport?.modelBreakdown && Object.keys(latestReport.modelBreakdown).length > 0 && (
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="font-semibold mb-4">🤖 Model Usage</h3>
                      <div className="space-y-2">
                        {Object.entries(latestReport.modelBreakdown).map(([model, count]) => (
                          <div key={model} className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3">
                            <span className="font-mono text-sm truncate flex-1 mr-2">{model}</span>
                            <span className="font-semibold">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Last updated */}
              {data?.reportedAt && (
                <p className="text-center text-zinc-500 text-sm">
                  Last updated: {new Date(data.reportedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
              <h2 className="text-xl font-bold mb-6">🔔 Alert Settings</h2>
              <p className="text-zinc-400 mb-6">Configure alerts for cost thresholds and downtime notifications.</p>
              <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
                <span className="text-zinc-500">Alert configuration coming soon...</span>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
              <h2 className="text-xl font-bold mb-6">⚙️ Settings</h2>
              <p className="text-zinc-400">Workspace and account settings.</p>
            </div>
          )}

          {activeTab === "install" && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
              <h2 className="text-xl font-bold mb-6">📥 Install Reporter</h2>
              <div className="space-y-4">
                <p className="text-zinc-400">Add this cron job to your OpenClaw deployment to report metrics:</p>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
                  <code className="text-sm text-emerald-400 whitespace-nowrap">
                    */5 * * * * cd /home/dave/repos/pawprint/packages/reporter && node reporter.ts --workspace 1
                  </code>
                </div>
                <p className="text-xs text-zinc-500">
                  This runs every 5 minutes and sends metrics to your dashboard.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Loading skeleton
function LoadingState() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🐾</div>
        <p className="text-zinc-500">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Main client component
export default function DashboardClient({ 
  initialData, 
  workspaceId 
}: { 
  initialData: DashboardData | null;
  workspaceId: string;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <LoadingState />;
  }

  if (!session) {
    return <LandingPage />;
  }

  if (!initialData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-zinc-400">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return <AuthDashboard data={initialData} workspaceId={workspaceId} />;
}
