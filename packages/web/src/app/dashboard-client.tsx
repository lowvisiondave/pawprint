"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardData {
  latestReport: {
    timestamp: string;
    gateway: { online: boolean; uptime: number };
    sessions: { active: number; total: number };
    crons: { enabled: number; total: number; jobs?: any[] };
    costs: { today: number; month: number };
    tokens?: { input: number; output: number };
    errors?: {
      last24h: number;
      lastError?: { message: string; timestamp: string };
    };
    system?: {
      hostname?: string;
      platform?: string;
      arch?: string;
      cpuCount?: number;
      cpuUsagePercent?: number;
      memoryTotalMb?: number;
      memoryFreeMb?: number;
      memoryUsedPercent?: number;
      diskTotalGb?: number;
      diskFreeGb?: number;
      diskUsedPercent?: number;
      localIp?: string;
      uptime?: number;
    };
  } | null;
  reportedAt: string | null;
  gatewayOnline: boolean;
}

interface Agent {
  hostname: string;
  lastSeen: string;
  isOnline: boolean;
  sessions24h: number;
  totalSessions: number;
  tokensInput: number;
  tokensOutput: number;
  platform: string;
  arch: string;
  cpuCount: number;
  avgCpu: number;
  avgMemory: number;
  uptime: number;
  ip: string;
}

interface HistoryPoint {
  timestamp: string;
  sessions_active: number;
  cost_today: number;
}

// Skeleton loader
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded ${className}`} />;
}

// Landing page component - Vercel style
function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-5xl mx-auto px-6">
        <header className="flex items-center justify-between py-6 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <span className="text-xl">🐾</span>
            <span className="font-semibold text-lg">PawPrint</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-zinc-500 hover:text-white text-sm transition-colors">Features</a>
            <a href="#pricing" className="text-zinc-500 hover:text-white text-sm transition-colors">Pricing</a>
            <button onClick={() => signIn("github")} className="text-sm font-medium text-white hover:text-zinc-300 transition-colors">
              Sign In
            </button>
          </div>
        </header>

        <main>
          <section className="py-32 text-center">
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight mb-6">Monitor your AI agents</h1>
            <p className="text-xl text-zinc-400 mb-10 max-w-xl mx-auto">
              Real-time metrics for sessions, tokens, costs, and system health. Deploy in seconds.
            </p>
            <button onClick={() => signIn("github")} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-zinc-200 transition-colors">
              Start Monitoring <span>›</span>
            </button>
          </section>

          <section id="features" className="py-24 border-t border-zinc-900">
            <h2 className="text-2xl font-semibold mb-12">Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Real-Time Metrics", desc: "Track sessions, tokens, and costs as they happen." },
                { title: "System Health", desc: "CPU, memory, disk, and network monitoring." },
                { title: "Smart Alerts", desc: "Get notified when costs spike or agents go offline." },
                { title: "Historical Data", desc: "7-day and 30-day trends with charts." },
                { title: "Multi-Workspace", desc: "Organize agents by project or client." },
                { title: "Easy Setup", desc: "One command to install. Auto-starts with cron." },
              ].map((f, i) => (
                <div key={i} className="p-6 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-colors">
                  <h3 className="font-medium mb-2">{f.title}</h3>
                  <p className="text-zinc-500 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="py-12 border-t border-zinc-900 text-sm text-zinc-500">
            <div className="flex items-center justify-between">
              <p>Built by Dave</p>
              <a href="https://github.com/lowvisiondave/pawprint" className="flex items-center gap-1 hover:text-white transition-colors">
                GitHub <span>↗</span>
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// Authenticated Dashboard
function AuthDashboard({ data, agents: initialAgents, workspaceId }: { data: DashboardData; agents: Agent[]; workspaceId: string }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/history?workspace_id=${workspaceId}&hours=${hours}`)
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }, [workspaceId, hours]);

  const latest = data?.latestReport;
  const isOnline = data?.gatewayOnline;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-6xl mx-auto px-6">
        <header className="flex items-center justify-between py-5 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <span className="text-xl">🐾</span>
            <span className="font-semibold">PawPrint</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{session?.user?.name}</span>
            <button onClick={() => signOut()} className="text-sm text-zinc-500 hover:text-white">Sign Out</button>
          </div>
        </header>

        <nav className="flex gap-8 py-4 border-b border-zinc-900">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'agents', label: `Agents (${initialAgents.length})` },
            { id: 'errors', label: 'Errors' },
            { id: 'settings', label: 'Settings' },
          ].map(tab => (
            <Link key={tab.id} href={`?tab=${tab.id}&workspace_id=${workspaceId}`}
              className={`text-sm font-medium pb-4 border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}>
              {tab.label}
            </Link>
          ))}
        </nav>

        {activeTab === 'dashboard' && (
          <main className="py-8">
            {loading ? (
              <div className="grid md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : latest ? (
              <>
                <div className="grid md:grid-cols-5 gap-4 mb-8">
                  <StatCard label="Active Sessions" value={latest.sessions.active.toString()} sublabel="now" />
                  <StatCard label="Total Sessions" value={latest.sessions.total.toString()} sublabel="all time" />
                  <StatCard label="Uptime" value={formatUptime(latest.gateway.uptime)} />
                  <div className="p-4 border border-zinc-900 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Cost Today</div>
                    <div className="text-2xl font-medium">${latest.costs.today.toFixed(4)}</div>
                    {latest.costs.today > 0 && (
                      <div className="text-xs text-zinc-500 mt-1">
                        ~${(latest.costs.today * 30).toFixed(2)}/mo projected
                      </div>
                    )}
                  </div>
                  <div className={`p-4 border rounded-lg ${(latest.errors?.last24h ?? 0) > 0 ? 'border-red-900 bg-red-900/10' : 'border-zinc-900'}`}>
                    <div className="text-xs text-zinc-500 mb-1">Errors (24h)</div>
                    <div className={`text-2xl font-medium ${(latest.errors?.last24h ?? 0) > 0 ? 'text-red-400' : ''}`}>{latest.errors?.last24h || 0}</div>
                  </div>
                </div>

                {latest.system && (
                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <StatCard label="CPU" value={`${latest.system.cpuUsagePercent || 0}%`} sublabel={`${latest.system.cpuCount} cores`} />
                    <StatCard label="Memory" value={`${latest.system.memoryUsedPercent || 0}%`} sublabel={`${latest.system.memoryFreeMb}MB free`} />
                    <StatCard label="Disk" value={`${latest.system.diskUsedPercent || 0}%`} sublabel={`${latest.system.diskFreeGb}GB free`} />
                  </div>
                )}

                {latest.crons?.jobs && latest.crons.jobs.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Cron Jobs</h2>
                    <div className="space-y-2">
                      {latest.crons.jobs.map((job: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-zinc-900 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${
                              job.lastStatus === 'success' ? 'bg-emerald-500' : 
                              job.lastStatus === 'failed' ? 'bg-red-500' : 
                              job.lastStatus === 'running' ? 'bg-yellow-500' : 'bg-zinc-600'
                            }`} />
                            <span className="font-medium">{job.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-zinc-400">
                            <span>{job.schedule}</span>
                            {job.lastRun && (
                              <span>{new Date(job.lastRun).toLocaleString()}</span>
                            )}
                            {job.lastDuration && (
                              <span>{Math.round(job.lastDuration / 1000)}s</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latest.tokens && (
                  <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div className="p-4 border border-zinc-900 rounded-lg">
                      <div className="text-xs text-zinc-500 mb-1">Input Tokens</div>
                      <div className="text-2xl font-medium">{latest.tokens.input.toLocaleString()}</div>
                    </div>
                    <div className="p-4 border border-zinc-900 rounded-lg">
                      <div className="text-xs text-zinc-500 mb-1">Output Tokens</div>
                      <div className="text-2xl font-medium">{latest.tokens.output.toLocaleString()}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">History</h2>
                  <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
                    <button
                      onClick={() => setHours(24)}
                      className={`px-3 py-1 text-sm rounded ${hours === 24 ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      24h
                    </button>
                    <button
                      onClick={() => setHours(168)}
                      className={`px-3 py-1 text-sm rounded ${hours === 168 ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      7d
                    </button>
                  </div>
                </div>

                {history.length > 0 && (
                  <>
                    <div className="border border-zinc-900 rounded-lg p-6 mb-6">
                      <h3 className="text-sm font-medium text-zinc-400 mb-4">Sessions ({hours}h)</h3>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={history}>
                            <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#52525b" fontSize={12} />
                            <YAxis stroke="#52525b" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a' }} labelFormatter={(t) => new Date(t).toLocaleString()} />
                            <Line type="monotone" dataKey="sessions_active" stroke="#fff" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="border border-zinc-900 rounded-lg p-6">
                      <h3 className="text-sm font-medium text-zinc-400 mb-4">Cost ({hours}h)</h3>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={history}>
                            <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#52525b" fontSize={12} />
                            <YAxis stroke="#52525b" fontSize={12} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a' }} labelFormatter={(t) => new Date(t).toLocaleString()} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                            <Line type="monotone" dataKey="cost_today" stroke="#22c55e" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}

                <p className="text-xs text-zinc-600 mt-6">
                  Last updated: {data.reportedAt ? new Date(data.reportedAt).toLocaleString() : 'Never'}
                </p>
              </>
            ) : (
              <div className="text-center py-16 text-zinc-500">No data yet.</div>
            )}
          </main>
        )}

        {activeTab === 'agents' && (
          <main className="py-8">
            <h2 className="text-xl font-semibold mb-6">Agents</h2>
            
            {initialAgents.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 border border-zinc-900 rounded-lg">
                <p className="mb-2">No agents reporting yet.</p>
                <p className="text-sm">Install the reporter on your machines to start monitoring.</p>
                <code className="block mt-4 text-xs bg-zinc-900 p-3 rounded text-left">
                  curl -fsSL https://pawprint.dev/install.sh | bash -s YOUR_API_KEY
                </code>
              </div>
            ) : (
              <div className="space-y-4">
                {initialAgents.map((agent) => (
                  <div key={agent.hostname} className="p-4 border border-zinc-900 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${agent.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                        <span className="font-medium">{agent.hostname}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{agent.platform}/{agent.arch}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-500">Sessions (24h)</div>
                        <div className="font-medium">{agent.sessions24h}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Total</div>
                        <div className="font-medium">{agent.totalSessions}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">CPU</div>
                        <div className="font-medium">{agent.avgCpu}%</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Memory</div>
                        <div className="font-medium">{agent.avgMemory}%</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">IP</div>
                        <div className="font-mono text-xs">{agent.ip}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Uptime</div>
                        <div className="font-medium">{formatUptime(agent.uptime || 0)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {activeTab === 'errors' && (
          <main className="py-8">
            <h2 className="text-xl font-semibold mb-6">Error Log</h2>
            
            {data.latestReport?.errors ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-zinc-900 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Errors (24h)</div>
                    <div className="text-3xl font-medium text-red-400">{data.latestReport?.errors?.last24h || 0}</div>
                  </div>
                  {data.latestReport?.errors?.lastError && (
                    <div className="p-4 border border-zinc-900 rounded-lg">
                      <div className="text-xs text-zinc-500 mb-1">Last Error</div>
                      <div className="text-sm text-red-300">{data.latestReport?.errors?.lastError.message}</div>
                      <div className="text-xs text-zinc-600 mt-1">
                        {data.latestReport?.errors?.lastError.timestamp ? new Date(data.latestReport?.errors?.lastError.timestamp).toLocaleString() : ''}
                      </div>
                    </div>
                  )}
                </div>
                
                {(data.latestReport?.errors?.last24h ?? 0) > 0 && (
                  <div className="mt-6 p-4 border border-red-900/50 bg-red-900/10 rounded-lg">
                    <h3 className="text-sm font-medium text-red-400 mb-2">⚠️ Action Needed</h3>
                    <p className="text-sm text-zinc-400">
                      {data.latestReport?.errors?.last24h} errors detected in the last 24 hours. 
                      Check the session logs for details.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-zinc-500 border border-zinc-900 rounded-lg">
                No error tracking data available.
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="p-4 border border-zinc-900 rounded-lg">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
      {sublabel && <div className="text-xs text-zinc-600">{sublabel}</div>}
    </div>
  );
}

export default function Dashboard({ initialData, agents, workspaceId }: { initialData: DashboardData | null; agents: Agent[]; workspaceId: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-500">Loading...</div></div>;
  }

  if (!session) return <LandingPage />;
  if (!initialData) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-500">Failed to load data</div></div>;

  return <AuthDashboard data={initialData} agents={agents} workspaceId={workspaceId} />;
}
