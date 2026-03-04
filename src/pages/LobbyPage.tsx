import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useLobby } from "../hooks/useLobby";
import { useTable } from "../hooks/useTable";
import { LobbyHeader } from "../components/lobby/LobbyHeader";
import { LobbyStats } from "../components/lobby/LobbyStats";
import { OnlineUsersList } from "../components/lobby/OnlineUsersList";
import { QuickMatchButton } from "../components/lobby/QuickMatchButton";
import { CreateTableButton } from "../components/lobby/CreateTableButton";
import { TableList } from "../components/lobby/TableList";
import { LobbyChat } from "../components/lobby/LobbyChat";
import { HostTableModal } from "../components/lobby/HostTableModal";
import { Modal } from "../components/common/Modal";
import { Button } from "../components/common/Button";
import type { LobbyStatus } from "../types";

export function LobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { onlineUsers, stats, updateStatus } = useLobby();
  const {
    tables,
    myTable,
    myRequest,
    incomingRequests,
    role,
    loading: tableLoading,
    error: tableError,
    createTable,
    cancelTable,
    sendJoinRequest,
    cancelJoinRequest,
    acceptRequest,
    rejectRequest,
    tableMatchStatus,
    acceptedByMe,
    opponentAccepted,
    acceptTableMatch,
    declineTableMatch,
    matchedGameId,
    matchedOpponent,
  } = useTable();

  const [showHostModal, setShowHostModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [tableMatchCountdown, setTableMatchCountdown] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Track the last table ID we auto-opened the modal for, to avoid re-opening on every render
  const autoOpenedForTableRef = useRef<string | null>(null);

  // Update presence status when matchmaking state changes
  const handleMatchmakingStatusChange = useCallback(
    (matchStatus: string) => {
      if (matchStatus === "searching") {
        updateStatus("in_queue" as LobbyStatus);
      } else if (matchStatus === "matched") {
        updateStatus("in_game" as LobbyStatus);
      } else {
        // Only reset to idle if not hosting a table
        if (role !== "host") {
          updateStatus("idle" as LobbyStatus);
        }
      }
    },
    [updateStatus, role]
  );

  // Update presence when hosting a table
  useEffect(() => {
    if (role === "host") {
      updateStatus("hosting_table" as LobbyStatus);
    }
  }, [role, updateStatus]);

  // Show host modal automatically when a NEW table is created (only once per table)
  useEffect(() => {
    if (role === "host" && myTable && autoOpenedForTableRef.current !== myTable.id) {
      autoOpenedForTableRef.current = myTable.id;
      setShowHostModal(true);
    }
    // When table is gone, reset the ref so next table auto-opens again
    if (!myTable) {
      autoOpenedForTableRef.current = null;
    }
  }, [role, myTable]);

  // One-time notice from navigation state (e.g. match abandoned redirect)
  useEffect(() => {
    const state = location.state as { notice?: string } | null;
    if (state?.notice) {
      setNotice(state.notice);
    }
  }, [location.state]);

  // Show match modal for handshake and final match-ready state
  useEffect(() => {
    if (tableMatchStatus === "pending_accept" || tableMatchStatus === "matched") {
      setShowMatchModal(true);
    } else {
      setShowMatchModal(false);
    }
  }, [tableMatchStatus]);

  useEffect(() => {
    if (tableMatchStatus !== "pending_accept") {
      setTableMatchCountdown(null);
      return;
    }

    setTableMatchCountdown(10);
    const timer = setInterval(() => {
      setTableMatchCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          void declineTableMatch("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tableMatchStatus, declineTableMatch]);

  // Navigate when both accepted and game is created
  useEffect(() => {
    if (tableMatchStatus !== "matched" || !matchedGameId) return;
    navigate(`/game/${matchedGameId}`);
  }, [tableMatchStatus, matchedGameId, navigate]);

  const handleCreateTable = async () => {
    await createTable();
  };

  const handleCancelTable = async () => {
    await cancelTable();
    setShowHostModal(false);
    updateStatus("idle" as LobbyStatus);
  };

  const handleJoinRequest = async (tableId: string) => {
    await sendJoinRequest(tableId);
  };

  const handleAcceptRequest = async (requestId: string) => {
    await acceptRequest(requestId);
    setShowHostModal(false);
  };

  const canJoinTable = role === "none" && !myRequest;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <LobbyHeader />

      <div className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:p-6">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {notice && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-amber-200">{notice}</p>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-xs text-amber-300 hover:text-amber-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <LobbyStats stats={stats} />

          <div className="flex gap-3 lg:flex-col">
            <div className="flex-1">
              <QuickMatchButton
                onStatusChange={handleMatchmakingStatusChange}
                onlineUserIds={new Set(onlineUsers.map((u) => u.user_id))}
              />
            </div>
            <div className="flex-1">
              <CreateTableButton
                isHosting={role === "host"}
                hasActiveRequest={role === "requester"}
                loading={tableLoading}
                onCreateTable={handleCreateTable}
                onViewTable={() => setShowHostModal(true)}
              />
            </div>
          </div>

          {/* Pending request indicator */}
          {role === "requester" && myRequest && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                  <p className="text-xs text-blue-300">
                    Waiting for host approval...
                  </p>
                </div>
                <button
                  onClick={cancelJoinRequest}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table error */}
          {tableError && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-2">
              <p className="text-xs text-red-400">{tableError}</p>
            </div>
          )}

          <OnlineUsersList
            users={onlineUsers}
            currentUserId={user?.id ?? ""}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-col gap-4">
          <TableList
            tables={tables}
            currentUserId={user?.id ?? ""}
            canJoin={canJoinTable}
            onJoinRequest={handleJoinRequest}
          />
          <LobbyChat />
        </div>
      </div>

      {/* Host Table Modal */}
      <HostTableModal
        isOpen={showHostModal && role === "host"}
        onClose={() => setShowHostModal(false)}
        requests={incomingRequests}
        onAccept={handleAcceptRequest}
        onReject={rejectRequest}
        onCancelTable={handleCancelTable}
        loading={tableLoading}
      />

      {/* Match Found Modal (table handshake) */}
      <Modal
        isOpen={showMatchModal}
        onClose={() => {
          setShowMatchModal(false);
          if (tableMatchStatus === "pending_accept") {
            void declineTableMatch();
          }
        }}
        title="Battle Stations!"
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full border-2 border-emerald-500/20" />
            <div
              className="absolute h-3/4 w-3/4 animate-ping rounded-full border-2 border-emerald-500/30"
              style={{ animationDelay: "0.5s" }}
            />
            <div className="relative z-10 text-4xl">🎯</div>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-emerald-300">
              Opponent Located!
            </p>
            <p className="mt-1 text-sm text-slate-300">
              You have been matched with
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {matchedOpponent ?? "Unknown Captain"}
            </p>
          </div>

          {tableMatchStatus === "pending_accept" && (
            <div className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
              <p>You: {acceptedByMe ? "Accepted" : "Pending"}</p>
              <p>Opponent: {opponentAccepted ? "Accepted" : "Pending"}</p>
            </div>
          )}

          {tableMatchStatus === "pending_accept" && tableMatchCountdown !== null && (
            <div className="w-full rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-center text-xs text-emerald-200">
              Match starts in {tableMatchCountdown}s. Both players must accept.
            </div>
          )}

          {tableMatchStatus === "pending_accept" && !acceptedByMe && (
            <Button
              fullWidth
              onClick={() => void acceptTableMatch()}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Accept Match
            </Button>
          )}

          {tableMatchStatus === "pending_accept" && (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setShowMatchModal(false);
                void declineTableMatch();
              }}
            >
              Decline Match
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
