import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { useMatchmaking } from "../../hooks/useMatchmaking";

interface QuickMatchButtonProps {
  onStatusChange?: (status: string) => void;
  onlineUserIds: Set<string>;
}

export function QuickMatchButton({ onStatusChange, onlineUserIds }: QuickMatchButtonProps) {
  const navigate = useNavigate();
  const {
    status,
    error,
    matchedGameId,
    matchedOpponent,
    acceptedByMe,
    opponentAccepted,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    expirePendingMatch,
    finalizeMatch,
  } = useMatchmaking(onlineUserIds);

  const [showMatchModal, setShowMatchModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (status === "pending_accept") {
      setShowMatchModal(true);
    } else {
      setShowMatchModal(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "matched" && matchedGameId) {
      navigate(`/game/${matchedGameId}`);
    }
  }, [status, matchedGameId, navigate]);

  useEffect(() => {
    if (status !== "pending_accept") {
      setCountdown(null);
      return;
    }

    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          void expirePendingMatch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, expirePendingMatch]);

  useEffect(() => {
    if (status !== "pending_accept") return;
    if (!acceptedByMe || !opponentAccepted) return;
    setShowMatchModal(false);
    void finalizeMatch();
  }, [status, acceptedByMe, opponentAccepted, finalizeMatch]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleClick = async () => {
    if (status === "searching") {
      await leaveQueue();
    } else if (status === "pending_accept" || status === "matched") {
      setShowMatchModal(true);
    } else {
      await joinQueue();
    }
  };

  const isSearching = status === "searching";
  const isTimeout = status === "timeout";
  const isPendingAccept = status === "pending_accept";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {isTimeout && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-amber-300">
              No ships spotted on the radar!
            </p>
            <p className="mt-1 text-xs text-amber-400/70">
              The seas are empty, Captain. No opponents found.
            </p>
          </div>
        )}

        <Button
          fullWidth
          onClick={handleClick}
          variant={isSearching ? "secondary" : "primary"}
          className={
            isSearching
              ? "border-amber-500/50 text-amber-300 hover:border-amber-400 hover:text-amber-200"
              : isPendingAccept
                ? "border-blue-500/50 bg-blue-600 text-blue-100 hover:bg-blue-500"
                : ""
          }
        >
          {isSearching ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
              Cancel Search
            </span>
          ) : isPendingAccept ? (
            "Match Found - Respond"
          ) : isTimeout ? (
            "Scan Again"
          ) : (
            "Quick Match"
          )}
        </Button>

        {isSearching && (
          <p className="animate-pulse text-center text-xs text-amber-400/80">
            Scanning the seas for opponents...
          </p>
        )}

        {status === "error" && error && (
          <p className="text-center text-xs text-red-400">{error}</p>
        )}

        {status === "idle" && error && (
          <p className="text-center text-xs text-amber-300">{error}</p>
        )}
      </div>

      <Modal
        isOpen={showMatchModal}
        onClose={async () => {
          setShowMatchModal(false);
          if (isPendingAccept) {
            await declineMatch();
          } else {
            await leaveQueue();
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
            <div className="relative z-10 text-4xl" role="img" aria-label="Target">
              {"\u{1F3AF}"}
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-emerald-300">Opponent Located!</p>
            <p className="mt-1 text-sm text-slate-300">You have been matched with</p>
            <p className="mt-1 text-xl font-bold text-white">
              {matchedOpponent ?? "Unknown Captain"}
            </p>
          </div>

          {isPendingAccept && (
            <div className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
              <p>You: {acceptedByMe ? "Accepted" : "Pending"}</p>
              <p>Opponent: {opponentAccepted ? "Accepted" : "Pending"}</p>
            </div>
          )}

          {isPendingAccept && !acceptedByMe && (
            <Button
              fullWidth
              onClick={acceptMatch}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Accept Match
            </Button>
          )}

          {isPendingAccept && countdown !== null && !(acceptedByMe && opponentAccepted) && (
            <div className="w-full rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-center text-xs text-emerald-200">
              Match starts in {countdown}s. Both players must accept.
            </div>
          )}

          <Button
            fullWidth
            variant="secondary"
            onClick={async () => {
              setShowMatchModal(false);
              if (isPendingAccept) {
                await declineMatch();
              } else {
                await leaveQueue();
              }
            }}
          >
            {isPendingAccept ? "Decline Match" : "Return to Lobby"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
