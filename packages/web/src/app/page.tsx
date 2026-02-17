"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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
      fetch(`${API_URL}/api/v1/dashboard?workspace_id=${selectedWorkspace.id}`)
        .then((res) => res.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [selectedWorkspace]);

  // Auto-refresh every 5 min
  useEffect(() => {
    if (!selectedWorkspace) return;
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/v1/dashboard?workspace_id=${selectedWorkspace.id}`)
        .then((res) => res.json())
        .then(setData);
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
            <span className="text-sm text-zinc-400">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut()}
              className="text-zinc-400 hover:text-zinc-100 text-sm"
            >
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
            <div className="grid grid-cols-4 gap-4 mb-8">
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

            {/* API Key section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
              <div className="text-sm text-zinc-400 mb-2">Reporter API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-950 px-3 py-2 rounded font-mono text-sm">
                  {selectedWorkspace?.api_key}
                </code>
                <button
                  onClick={copyApiKey}
                  className="bg-zinc-800 px-3 py-2 rounded text-sm hover:bg-zinc-700"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Use this key in your reporter config: PAWPRINT_API_KEY={selectedWorkspace?.api_key}
              </p>
            </div>

            {/* Last report */}
            <div className="text-sm text-zinc-500">
              Last report: {reportedAt ? new Date(reportedAt).toLocaleString() : "Never"}
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
