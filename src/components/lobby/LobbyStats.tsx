interface LobbyStatsProps {
  stats: { online: number; playing: number; waiting: number };
}

export function LobbyStats({ stats }: LobbyStatsProps) {
  return (
    <div className="flex gap-3 lg:flex-col">
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Online
        </div>
        <p className="mt-1 text-2xl font-bold text-slate-100">{stats.online}</p>
      </div>
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-base">🎮</span>
          Playing
        </div>
        <p className="mt-1 text-2xl font-bold text-slate-100">{stats.playing}</p>
      </div>
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-base">⏳</span>
          In Queue
        </div>
        <p className="mt-1 text-2xl font-bold text-slate-100">{stats.waiting}</p>
      </div>
    </div>
  );
}
