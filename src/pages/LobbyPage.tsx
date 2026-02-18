import { useAuth } from "../hooks/useAuth";
import { useLobby } from "../hooks/useLobby";
import { LobbyHeader } from "../components/lobby/LobbyHeader";
import { LobbyStats } from "../components/lobby/LobbyStats";
import { OnlineUsersList } from "../components/lobby/OnlineUsersList";
import { QuickMatchButton } from "../components/lobby/QuickMatchButton";
import { CreateTableButton } from "../components/lobby/CreateTableButton";
import { TableList } from "../components/lobby/TableList";
import { LobbyChat } from "../components/lobby/LobbyChat";

export function LobbyPage() {
  const { user } = useAuth();
  const { onlineUsers, stats } = useLobby();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <LobbyHeader />

      <div className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:p-6">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <LobbyStats stats={stats} />

          <div className="flex gap-3 lg:flex-col">
            <div className="flex-1">
              <QuickMatchButton />
            </div>
            <div className="flex-1">
              <CreateTableButton />
            </div>
          </div>

          <OnlineUsersList
            users={onlineUsers}
            currentUserId={user?.id ?? ""}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-col gap-4">
          <TableList />
          <LobbyChat />
        </div>
      </div>
    </div>
  );
}
