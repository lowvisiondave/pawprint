"use client";

interface StatusData {
  workspace?: {
    name: string;
    slug: string;
  };
  status?: string;
  lastCheck?: string;
  sessions?: {
    active: number;
    total: number;
  };
  system?: {
    hostname: string;
    platform: string;
    cpuUsagePercent: number;
    memoryUsedPercent: number;
    diskUsedPercent: number;
  };
  uptime?: {
    day: number;
    week: number;
    month: number;
  };
  error?: string;
}

function StatusClient({ data, slug }: { data: StatusData | null; slug: string }) {
  if (!data || data.error === "Status page not found") {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-semibold mb-2">Status not found</h1>
          <p className="text-zinc-500">No agent with name "{slug}"</p>
        </div>
      </div>
    );
  }

  if (data.error === "private") {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-semibold mb-2">Private Status Page</h1>
          <p className="text-zinc-500">This agent's status is not public.</p>
          <p className="text-zinc-600 text-sm mt-2">Contact the owner to request access.</p>
        </div>
      </div>
    );
  }

  if (data.status === "no_data") {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-semibold mb-2">No data yet</h1>
          <p className="text-zinc-500">This agent hasn't reported yet</p>
        </div>
      </div>
    );
  }

  const isOnline = data.status === "online";

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {data.uptime && (
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border border-zinc-900 rounded-lg text-center">
                <div className="text-xs text-zinc-500 mb-1">24h</div>
                <div className={`text-2xl font-bold ${data.uptime.day >= 99 ? 'text-emerald-400' : data.uptime.day >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.uptime.day}%
                </div>
              </div>
              <div className="p-4 border border-zinc-900 rounded-lg text-center">
                <div className="text-xs text-zinc-500 mb-1">7 days</div>
                <div className={`text-2xl font-bold ${data.uptime.week >= 99 ? 'text-emerald-400' : data.uptime.week >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.uptime.week}%
                </div>
              </div>
              <div className="p-4 border border-zinc-900 rounded-lg text-center">
                <div className="text-xs text-zinc-500 mb-1">30 days</div>
                <div className={`text-2xl font-bold ${data.uptime.month >= 99 ? 'text-emerald-400' : data.uptime.month >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.uptime.month}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🐾</div>
          <h1 className="text-3xl font-semibold mb-2">{data.workspace?.name}</h1>
          <p className="text-zinc-500">Agent Status</p>
        </div>

        {data.system && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 border border-zinc-900 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">CPU</div>
              <div className="text-xl font-medium">{data.system.cpuUsagePercent || 0}%</div>
            </div>
            <div className="p-4 border border-zinc-900 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">Memory</div>
              <div className="text-xl font-medium">{data.system.memoryUsedPercent || 0}%</div>
            </div>
            <div className="p-4 border border-zinc-900 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">Disk</div>
              <div className="text-xl font-medium">{data.system.diskUsedPercent || 0}%</div>
            </div>
          </div>
        )}

        {data.sessions && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 border border-zinc-900 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">Active Sessions</div>
              <div className="text-xl font-medium">{data.sessions.active}</div>
            </div>
            <div className="p-4 border border-zinc-900 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">Total Sessions</div>
              <div className="text-xl font-medium">{data.sessions.total}</div>
            </div>
          </div>
        )}

        <p className="text-xs text-zinc-600 text-center">
          Last checked: {data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'Never'}
        </p>

        <p className="text-xs text-zinc-600 text-center mt-2">
          <a href={`https://pawprint-livid.vercel.app`} className="hover:text-white transition-colors">
            Powered by 🐾 PawPrint
          </a>
        </p>
      </div>
    </div>
  );
}

export default StatusClient;
