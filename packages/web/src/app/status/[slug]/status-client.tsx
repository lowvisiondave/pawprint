"use client";

interface StatusData {
  workspace?: {
    name: string;
    slug: string;
  };
  status?: string;
  uptime?: number;
  lastCheck?: string;
  cost24h?: string;
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-zinc-950 to-zinc-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md w-full">
          {/* Status Badge */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full text-xl font-bold ${
              isOnline 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}>
              <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {isOnline ? "All Systems Operational" : "Some Issues Detected"}
            </div>
          </div>

          {/* Workspace Name */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🐾</div>
            <h1 className="text-4xl font-bold mb-2">{data.workspace?.name}</h1>
            <p className="text-zinc-400">Status Page</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">Uptime (24h)</div>
              <div className="text-3xl font-bold text-emerald-400">
                {data.uptime !== null ? `${data.uptime}%` : '—'}
              </div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-zinc-500 text-sm mb-1">Cost (24h)</div>
              <div className="text-3xl font-bold">
                ${data.cost24h || '0.00'}
              </div>
            </div>
          </div>

          {/* Last Check */}
          <div className="text-center text-zinc-500 text-sm">
            Last checked: {data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'Never'}
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
