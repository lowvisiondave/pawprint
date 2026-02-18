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
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐾</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              PawPrint
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-zinc-400 hover:text-white transition-colors hidden sm:block">Features</a>
            <a href="#how-it-works" className="text-zinc-400 hover:text-white transition-colors hidden sm:block">How it Works</a>
            <button
              onClick={() => signIn("github")}
              className="px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-semibold hover:bg-zinc-200 transition-all hover:scale-105"
            >
              Sign In
            </button>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero Section */}
          <section className="px-6 py-20 sm:py-32 text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-zinc-300">Now with real-time system monitoring</span>
            </div>
            
            <div className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent leading-tight">
              Monitor your<br />AI agents in real-time
            </div>
            <p className="text-xl sm:text-2xl text-zinc-400 mb-10 max-w-2xl mx-auto">
              Track sessions, token usage, costs, and system health. Get Slack alerts when things go wrong.
            </p>
            <button
              onClick={() => signIn("github")}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 text-white rounded-2xl font-bold text-lg hover:from-indigo-600 hover:via-purple-600 hover:to-violet-600 transition-all hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/25"
            >
              🚀 Sign in with GitHub — Free
            </button>
            <p className="mt-4 text-sm text-zinc-500">No credit card required</p>
          </section>

          {/* Features Section */}
          <section id="features" className="px-6 py-20 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need</h2>
              <p className="text-zinc-400 text-lg">Monitor your AI infrastructure at a glance</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: "📊", title: "Real-Time Metrics", desc: "Sessions, tokens, and costs at a glance. Know exactly what's happening with your agents.", color: "from-blue-500/20 to-blue-500/5" },
                { icon: "🖥️", title: "System Health", desc: "Memory, disk, and network monitoring. Spot issues before they become problems.", color: "from-emerald-500/20 to-emerald-500/5" },
                { icon: "🔔", title: "Smart Alerts", desc: "Slack notifications when costs spike or your agents go offline.", color: "from-amber-500/20 to-amber-500/5" },
                { icon: "📈", title: "Historical Trends", desc: "7-day and 30-day charts. Understand usage patterns over time.", color: "from-violet-500/20 to-violet-500/5" },
                { icon: "🔐", title: "Multi-Workspace", desc: "Monitor multiple deployments from one dashboard. Organize by project or client.", color: "from-cyan-500/20 to-cyan-500/5" },
                { icon: "⚡", title: "5-Minute Setup", desc: "One command to install. Reporter auto-starts with cron.", color: "from-pink-500/20 to-pink-500/5" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className={`backdrop-blur-xl bg-gradient-to-br ${feature.color} border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-1 group`}
                >
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-zinc-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works Section */}
          <section id="how-it-works" className="px-6 py-20 max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
              <p className="text-zinc-400 text-lg">Up and running in 2 minutes</p>
            </div>
            
            <div className="grid gap-6">
              {[
                { step: "1", title: "Sign in with GitHub", desc: "Create your account instantly. No passwords, no setup." },
                { step: "2", title: "Create a workspace", desc: "Organize your agents by project, client, or environment." },
                { step: "3", title: "Install the reporter", desc: "One command to start sending metrics. We'll handle the rest." },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-6 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                    <p className="text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="px-6 py-20 text-center">
            <div className="backdrop-blur-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-violet-500/20 border border-white/10 rounded-3xl p-12 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to monitor?</h2>
              <p className="text-zinc-400 text-lg mb-8">Join developers who know exactly what their AI agents are doing.</p>
              <button
                onClick={() => signIn("github")}
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 text-white rounded-2xl font-bold text-lg hover:from-indigo-600 hover:via-purple-600 hover:to-violet-600 transition-all hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/25"
              >
                🚀 Get Started — Free
              </button>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-zinc-500">
              <a href="https://github.com/lowvisiondave/pawprint" className="hover:text-white transition-colors">GitHub</a>
              <span>·</span>
              <span>Built by Dave & friends</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">PawPrint</span>
            </div>
          </div>
        </footer>
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
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    setLoading(true);
    const hours = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
    fetch(`${API_URL}/api/v1/history?workspace_id=${workspaceId}&hours=${hours}`)
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }, [workspaceId, timeRange]);

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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">📈 History</h3>
                <div className="flex bg-zinc-900/50 rounded-lg p-1">
                  {(["24h", "7d", "30d"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                        timeRange === range
                          ? "bg-indigo-500 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Cost Chart */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-semibold mb-4">💰 Cost ({timeRange})</h3>
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
                  <h3 className="font-semibold mb-4">💬 Sessions ({timeRange})</h3>
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
            <div className="space-y-6 max-w-2xl">
              {/* Quick Setup */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4">🐾 Quick Setup (2 minutes)</h2>
                
                <div className="space-y-4">
                  <div className="bg-zinc-900/50 rounded-xl p-4">
                    <div className="text-sm text-zinc-400 mb-2">Step 1: Copy Your API Key</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-emerald-400 text-sm">
                        pk_test_12345678
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText("pk_test_12345678")}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 rounded-xl p-4">
                    <div className="text-sm text-zinc-400 mb-2">Step 2: Run the Installer</div>
                    <p className="text-xs text-zinc-500 mb-3">Open a terminal on your OpenClaw host and run:</p>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-x-auto">
                      <code className="text-xs text-emerald-400 whitespace-nowrap">
                        curl -fsSL https://pawprint.dev/install.sh | bash -s pk_test_12345678
                      </code>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 rounded-xl p-4">
                    <div className="text-sm text-zinc-400 mb-2">Step 3: Verify It's Working</div>
                    <p className="text-xs text-zinc-500">The installer will:</p>
                    <ul className="text-xs text-zinc-400 mt-2 space-y-1">
                      <li>✓ Download the reporter</li>
                      <li>✓ Test the connection</li>
                      <li>✓ Set up automatic reporting (every 5 min)</li>
                    </ul>
                  </div>

                  <p className="text-sm text-emerald-400">
                    You should see "Report posted successfully" — then check your dashboard!
                  </p>
                </div>
              </div>

              {/* Manual Setup */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">📋 Manual Setup</h2>
                <p className="text-sm text-zinc-400 mb-4">If you prefer not to use the installer:</p>
                
                <div className="space-y-3 text-sm">
                  <div className="bg-zinc-900/50 rounded-lg p-3">
                    <div className="text-zinc-400 mb-1">1. Download the reporter:</div>
                    <code className="text-xs text-emerald-400">mkdir -p ~/.openclaw/pawprint && curl -o ~/.openclaw/pawprint/reporter.ts https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/reporter/reporter.ts</code>
                  </div>
                  
                  <div className="bg-zinc-900/50 rounded-lg p-3">
                    <div className="text-zinc-400 mb-1">2. Set your API key:</div>
                    <code className="text-xs text-emerald-400">echo "PAWPRINT_API_KEY=pk_test_12345678" &gt; ~/.openclaw/pawprint/.env</code>
                  </div>
                  
                  <div className="bg-zinc-900/50 rounded-lg p-3">
                    <div className="text-zinc-400 mb-1">3. Test it:</div>
                    <code className="text-xs text-emerald-400">cd ~/.openclaw/pawprint && npx tsx reporter.ts</code>
                  </div>
                  
                  <div className="bg-zinc-900/50 rounded-lg p-3">
                    <div className="text-zinc-400 mb-1">4. Add to cron (every 5 min):</div>
                    <code className="text-xs text-emerald-400">(crontab -l; echo "*/5 * * * * cd ~/.openclaw/pawprint && npx tsx reporter.ts") | crontab -</code>
                  </div>
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">❓ Troubleshooting</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-zinc-300">"OpenClaw directory not found"</div>
                    <div className="text-zinc-500 text-xs">Make sure OpenClaw is installed (~/.openclaw should exist)</div>
                  </div>
                  <div>
                    <div className="text-zinc-300">"API error 401"</div>
                    <div className="text-zinc-500 text-xs">Check your API key is correct</div>
                  </div>
                  <div>
                    <div className="text-zinc-300">"npx: command not found"</div>
                    <div className="text-zinc-500 text-xs">Install Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install nodejs</div>
                  </div>
                </div>
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
