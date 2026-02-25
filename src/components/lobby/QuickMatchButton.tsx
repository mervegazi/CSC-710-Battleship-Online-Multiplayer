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
  const { status, error, matchedGameId, matchedOpponent, joinQueue, leaveQueue } =
    useMatchmaking(onlineUserIds);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Show modal when matched
  useEffect(() => {
    if (status === "matched") {
      setShowMatchModal(true);
      setCountdown(5);
    }
  }, [status]);

  // Auto-navigate countdown when matched
  useEffect(() => {
    if (!showMatchModal || !matchedGameId) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(`/game/${matchedGameId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showMatchModal, matchedGameId, navigate]);

  // Notify parent of status changes (e.g. for lobby presence updates)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleClick = async () => {
    if (status === "searching") {
      await leaveQueue();
    } else if (status === "matched") {
      setShowMatchModal(true);
    } else {
      await joinQueue();
    }
  };

  const handleJoinBattle = () => {
    if (matchedGameId) {
      navigate(`/game/${matchedGameId}`);
    }
  };

  const isSearching = status === "searching";
  const isTimeout = status === "timeout";
  const isMatched = status === "matched";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {/* Timeout message */}
        {isTimeout && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-amber-300">
              🔭 No ships spotted on the radar!
            </p>
            <p className="mt-1 text-xs text-amber-400/70">
              The seas are empty, Captain. No opponents found.
            </p>
          </div>
        )}

        {/* Main button */}
        <Button
          fullWidth
          onClick={handleClick}
          variant={isSearching ? "secondary" : isMatched ? "primary" : "primary"}
          className={
            isSearching
              ? "border-amber-500/50 text-amber-300 hover:border-amber-400 hover:text-amber-200"
              : isMatched
                ? "border-emerald-500/50 bg-emerald-600 text-emerald-100 hover:bg-emerald-500"
                : ""
          }
        >
          {isSearching ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
              Cancel Search
            </span>
          ) : isMatched ? (
            "⚓ View Match"
          ) : isTimeout ? (
            "🔄 Scan Again"
          ) : (
            "⚡ Quick Match"
          )}
        </Button>

        {isSearching && (
          <p className="animate-pulse text-center text-xs text-amber-400/80">
            Scanning the seas for opponents…
          </p>
        )}

        {status === "error" && error && (
          <p className="text-center text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Match Found Modal */}
      <Modal
        isOpen={showMatchModal}
        onClose={() => {
          setShowMatchModal(false);
          leaveQueue();
        }}
        title="⚓ Battle Stations!"
      >
        <div className="flex flex-col items-center gap-4 py-2">
          {/* Radar animation */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full border-2 border-emerald-500/20" />
            <div className="absolute h-3/4 w-3/4 animate-ping rounded-full border-2 border-emerald-500/30" style={{ animationDelay: "0.5s" }} />
            <div className="relative z-10 text-4xl">🎯</div>
          </div>

          {/* Match info */}
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

          {/* Game ID */}
          {matchedGameId && (
            <div className="rounded-md bg-slate-800/60 px-3 py-1.5">
              <p className="text-xs text-slate-400">
                Game ID:{" "}
                <span className="font-mono text-slate-300">
                  {matchedGameId.slice(0, 8)}…
                </span>
              </p>
            </div>
          )}

          {/* Join Battle button */}
          <Button
            fullWidth
            onClick={handleJoinBattle}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            ⚔️ Join Battle ({countdown}s)
          </Button>

          <Button
            fullWidth
            variant="secondary"
            onClick={() => {
              setShowMatchModal(false);
              leaveQueue();
            }}
          >
            Return to Lobby
          </Button>
        </div>
      </Modal>
    </>
  );
}
