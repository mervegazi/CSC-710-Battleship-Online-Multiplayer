import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "../common/Button";
import { useMatchmaking } from "../../hooks/useMatchmaking";

interface QuickMatchButtonProps {
  onStatusChange?: (status: string) => void;
}

export function QuickMatchButton({ onStatusChange }: QuickMatchButtonProps) {
  const navigate = useNavigate();
  const { status, error, matchedGameId, joinQueue, leaveQueue } =
    useMatchmaking();

  // Navigate to game when matched
  useEffect(() => {
    if (status === "matched" && matchedGameId) {
      navigate(`/game/${matchedGameId}`);
    }
  }, [status, matchedGameId, navigate]);

  // Notify parent of status changes (e.g. for lobby presence updates)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleClick = async () => {
    if (status === "searching") {
      await leaveQueue();
    } else {
      await joinQueue();
    }
  };

  const isSearching = status === "searching";
  const isTimeout = status === "timeout";

  return (
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

      <Button
        fullWidth
        onClick={handleClick}
        variant={isSearching ? "secondary" : "primary"}
        className={
          isSearching
            ? "border-amber-500/50 text-amber-300 hover:border-amber-400 hover:text-amber-200"
            : ""
        }
      >
        {isSearching ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
            Cancel Search
          </span>
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
  );
}
