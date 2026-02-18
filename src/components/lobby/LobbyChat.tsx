export function LobbyChat() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-300">
        Lobby Chat
      </h3>
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-slate-500">Chat will be available soon.</p>
      </div>
      <div className="border-t border-slate-800 px-4 py-3">
        <input
          type="text"
          placeholder="Type a message..."
          disabled
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 placeholder-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}
