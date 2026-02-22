"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface WorkspaceSettings {
  id: number;
  name: string;
  api_key: string;
  alert_cost_threshold: string | null;
  alert_downtime_minutes: number;
  slack_webhook_url: string | null;
  alert_email: string | null;
}

export default function SettingsPage({ workspaceId }: { workspaceId: string }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "settings";
  
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [name, setName] = useState("");
  const [alertCostThreshold, setAlertCostThreshold] = useState("");
  const [alertDowntimeMinutes, setAlertDowntimeMinutes] = useState("5");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/workspace?id=${workspaceId}`)
      .then(r => r.json())
      .then(d => {
        if (d.workspace) {
          setSettings(d.workspace);
          setName(d.workspace.name || "");
          setAlertCostThreshold(d.workspace.alert_cost_threshold || "");
          setAlertDowntimeMinutes(String(d.workspace.alert_downtime_minutes || 5));
          setSlackWebhook(d.workspace.slack_webhook_url || "");
          setAlertEmail(d.workspace.alert_email || "");
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await fetch(`/api/v1/workspace?id=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          alert_cost_threshold: alertCostThreshold ? parseFloat(alertCostThreshold) : null,
          alert_downtime_minutes: parseInt(alertDowntimeMinutes) || 5,
          slack_webhook_url: slackWebhook || null,
          alert_email: alertEmail || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }
    
    setSaving(false);
  };

  const handleRegenerateKey = async () => {
    if (!confirm("This will invalidate your current API key. Continue?")) return;
    
    try {
      const res = await fetch(`/api/v1/workspace?id=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_api_key' }),
      });
      
      const data = await res.json();
      if (data.apiKey) {
        setSettings(s => s ? { ...s, api_key: data.apiKey } : null);
        setMessage({ type: 'success', text: 'API key regenerated!' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to regenerate key' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-4xl mx-auto px-6">
        <header className="flex items-center justify-between py-5 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <Link href={`/?tab=dashboard&workspace_id=${workspaceId}`} className="text-zinc-500 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl">🐾</span>
            <span className="font-semibold">PawPrint</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{session?.user?.name}</span>
          </div>
        </header>

        <nav className="flex gap-8 py-4 border-b border-zinc-900">
          {[
            { id: 'dashboard', label: 'Dashboard', href: `/?tab=dashboard&workspace_id=${workspaceId}` },
            { id: 'settings', label: 'Settings', href: `/?tab=settings&workspace_id=${workspaceId}` },
          ].map(tab => (
            <Link key={tab.id} href={tab.href}
              className={`text-sm font-medium pb-4 border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}>
              {tab.label}
            </Link>
          ))}
        </nav>

        <main className="py-8">
          <h1 className="text-2xl font-semibold mb-8">Workspace Settings</h1>
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-emerald-900/20 border border-emerald-900 text-emerald-400' : 'bg-red-900/20 border border-red-900 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-8">
            <section className="p-6 border border-zinc-900 rounded-xl">
              <h2 className="text-lg font-medium mb-4">Basic Info</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Workspace Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-white focus:outline-none"
                  />
                </div>
              </div>
            </section>

            <section className="p-6 border border-zinc-900 rounded-xl">
              <h2 className="text-lg font-medium mb-4">API Key</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Your API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={settings?.api_key || ""}
                      readOnly
                      className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={handleRegenerateKey}
                      className="px-4 py-2 bg-red-900/50 hover:bg-red-900 rounded-lg text-sm"
                    >
                      Regenerate
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Use this key in your reporter config or PAWPRINT_API_KEY environment variable.
                  </p>
                </div>
              </div>
            </section>

            <section className="p-6 border border-zinc-900 rounded-xl">
              <h2 className="text-lg font-medium mb-4">Alerts</h2>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Cost Alert Threshold ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={alertCostThreshold}
                      onChange={e => setAlertCostThreshold(e.target.value)}
                      placeholder="e.g. 10.00"
                      className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-white focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-zinc-500">Alert when daily cost exceeds this amount</p>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Downtime Alert (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={alertDowntimeMinutes}
                      onChange={e => setAlertDowntimeMinutes(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-white focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-zinc-500">Alert when no report received for this long</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-6 border border-zinc-900 rounded-xl">
              <h2 className="text-lg font-medium mb-4">Notifications</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Slack Webhook URL</label>
                  <input
                    type="url"
                    value={slackWebhook}
                    onChange={e => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-white focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Get your webhook URL from Slack: Apps → Incoming Webhooks → Add New
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Email for Alerts</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={e => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-white focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Receive email alerts (coming soon)</p>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
