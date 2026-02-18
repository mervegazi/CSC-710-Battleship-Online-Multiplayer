import type { PresenceState, LobbyStatus } from "../../types";

interface OnlineUsersListProps {
  users: PresenceState[];
  currentUserId: string;
}

const STATUS_COLORS: Record<LobbyStatus, string> = {
  idle: "bg-green-500",
  in_queue: "bg-yellow-500",
  hosting_table: "bg-blue-500",
  in_game: "bg-red-500",
};

export function OnlineUsersList({ users, currentUserId }: OnlineUsersListProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-300">
        Online Players
      </h3>
      <div className="max-h-64 overflow-y-auto">
        {users.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">No players online</p>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {users.map((user) => (
              <li
                key={user.user_id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${STATUS_COLORS[user.status]}`}
                />
                <span className="truncate text-sm text-slate-200">
                  {user.display_name}
                </span>
                {user.user_id === currentUserId && (
                  <span className="text-xs text-slate-500">(You)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
