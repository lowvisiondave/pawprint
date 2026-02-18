"use client";

interface StatusData {
  workspace?: {
    name: string;
    slug: string;
  };
  status?: string;
  uptime?: {
    "24h": number | null;
    "7d": number | null;
    "30d": number | null;
  };
  lastCheck?: string;
  cost24h?: string;
  incidents?: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
  updatedAt?: string;
}

function StatusClient({ data, slug }: { data: StatusData | null; slug: string }) {
  if (!data || !data.workspace) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Status page not found</h1>
          <p className="text-zinc-400">No workspace with slug "{slug}"</p>
          <a href="https://web-xi-khaki.vercel.app" className="inline-block mt-6 text-indigo-400 hover:text-indigo-300">
            ← Go to dashboard
          </a>
        </div>
      </div>
    );
  }

  const isOnline = data.status === 'online';
  const hasIncidents = data.incidents && data.incidents.length > 0;
  const uptime = data.uptime;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center px-6 py-16">
        <div className="max-w-2xl w-full">
          {/* Status Badge */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full text-xl font-bold ${
              isOnline && !hasIncidents
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : hasIncidents 
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                isOnline && !hasIncidents ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`} />
              {isOnline && !hasIncidents ? "All Systems Operational" : hasIncidents ? "Degraded Performance" : "System Issues"}
            </div>
          </div>

          {/* Workspace Name */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🐾</div>
            <h1 className="text-4xl font-bold mb-2">{data.workspace?.name}</h1>
            <p className="text-zinc-400">Status Page</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">24h Uptime</div>
              <div className={`text-3xl font-bold ${uptime?.["24h"] === 100 ? 'text-emerald-400' : uptime?.["24h"] && uptime?.["24h"] > 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                {uptime?.["24h"] !== null ? `${uptime?.["24h"]}%` : '—'}
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">7d Uptime</div>
              <div className={`text-3xl font-bold ${uptime?.["7d"] === 100 ? 'text-emerald-400' : uptime?.["7d"] && uptime?.["7d"] > 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                {uptime?.["7d"] !== null ? `${uptime?.["7d"]}%` : '—'}
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">30d Uptime</div>
              <div className={`text-3xl font-bold ${uptime?.["30d"] === 100 ? 'text-emerald-400' : uptime?.["30d"] && uptime?.["30d"] > 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                {uptime?.["30d"] !== null ? `${uptime?.["30d"]}%` : '—'}
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">Cost (24h)</div>
              <div className="text-3xl font-bold">
                ${data.cost24h || '0.00'}
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">Last Check</div>
              <div className="text-lg font-bold">
                {data.lastCheck ? new Date(data.lastCheck).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>

          {/* Recent Incidents */}
          {hasIncidents && (
            <div className="backdrop-blur-xl bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-4 text-yellow-400">⚠️ Recent Incidents</h2>
              <div className="space-y-3">
                {data.incidents?.map((incident, i) => (
                  <div key={i} className="flex items-start gap-3 bg-zinc-900/50 rounded-lg p-3">
                    <div className="text-sm text-zinc-500 mt-0.5">
                      {new Date(incident.timestamp).toLocaleString()}
                    </div>
                    <div className={`text-sm font-medium ${
                      incident.type === 'downtime' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {incident.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Check */}
          <div className="text-center text-zinc-500 text-sm">
            Last checked: {data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'Never'}
          </div>

          {/* Share Link */}
          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-sm mb-2">Share this status page:</p>
            <code className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-emerald-400">
              https://web-xi-khaki.vercel.app/status/{slug}
            </code>
          </div>

          {/* Powered By */}
          <div className="mt-12 text-center">
            <a 
              href="https://web-xi-khaki.vercel.app" 
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
              Powered by 🐾 PawPrint
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusClient;
