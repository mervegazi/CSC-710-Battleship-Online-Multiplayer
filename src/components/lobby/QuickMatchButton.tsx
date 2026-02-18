import { useEffect } from "react";
import { Button } from "../common/Button";
import { useMatchmaking } from "../../hooks/useMatchmaking";

interface QuickMatchButtonProps {
  onStatusChange?: (status: string) => void;
}

export function QuickMatchButton({ onStatusChange }: QuickMatchButtonProps) {
  const { status, error, matchedGameId, matchedOpponent, joinQueue, leaveQueue } =
    useMatchmaking();

  // Notify parent of status changes (e.g. for lobby presence updates)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleClick = async () => {
    if (status === "searching") {
      await leaveQueue();
    } else if (status === "matched") {
      // Already matched, do nothing (or could navigate to game in future)
      return;
    } else {
      await joinQueue();
    }
  };

  const isSearching = status === "searching";
  const isTimeout = status === "timeout";
  const isMatched = status === "matched";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Match found notification */}
      {isMatched && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-4 text-center">
          <div className="mb-2 text-2xl">⚓</div>
          <p className="text-sm font-bold text-emerald-300">
            Battle Stations!
          </p>
          <p className="mt-1 text-xs text-emerald-400/80">
            You matched with{" "}
            <span className="font-semibold text-emerald-300">
              {matchedOpponent ?? "an opponent"}
            </span>
          </p>
          {matchedGameId && (
            <p className="mt-0.5 text-[10px] text-emerald-500/60">
              Game ID: {matchedGameId.slice(0, 8)}…
            </p>
          )}
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-950/20 px-3 py-2">
            <p className="text-xs font-semibold text-amber-300">
              🚧 Game Board — Coming Soon
            </p>
            <p className="mt-0.5 text-[10px] text-amber-400/60">
              Ship placement & battle phases are under development
            </p>
          </div>
        </div>
      )}

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
      {!isMatched && (
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
      )}

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
