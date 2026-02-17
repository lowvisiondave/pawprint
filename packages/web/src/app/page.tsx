export default function Home() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 p-4">
        <h1 className="text-xl font-bold text-zinc-100 mb-8">🐾 PawPrint</h1>
        <nav className="space-y-2">
          <a href="#" className="block px-3 py-2 rounded bg-zinc-800 text-zinc-100">
            Dashboard
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Sessions
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Cron Jobs
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Costs
          </a>
          <a href="#" className="block px-3 py-2 rounded text-zinc-400 hover:text-zinc-100">
            Errors
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        {/* Status cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Active Sessions</div>
            <div className="text-2xl font-bold text-zinc-100">3</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Cron Jobs</div>
            <div className="text-2xl font-bold text-zinc-100">12</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Today's Cost</div>
            <div className="text-2xl font-bold text-emerald-400">$2.41</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm">Errors (24h)</div>
            <div className="text-2xl font-bold text-red-400">0</div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recent Sessions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-800">
                <th className="text-left py-2">Agent</th>
                <th className="text-left py-2">Model</th>
                <th className="text-left py-2">Tokens</th>
                <th className="text-left py-2">Cost</th>
                <th className="text-left py-2">Started</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800">
                <td className="py-2">main</td>
                <td className="py-2">minimax/M2.5</td>
                <td className="py-2">12,450</td>
                <td className="py-2">$0.12</td>
                <td className="py-2">2 min ago</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2">heartbeat</td>
                <td className="py-2">minimax/M2.5</td>
                <td className="py-2">890</td>
                <td className="py-2">$0.01</td>
                <td className="py-2">28 min ago</td>
              </tr>
              <tr>
                <td className="py-2">email-check</td>
                <td className="py-2">minimax/M2.5</td>
                <td className="py-2">2,100</td>
                <td className="py-2">$0.02</td>
                <td className="py-2">4 hrs ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
