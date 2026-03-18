import { useNavigate } from "react-router";
import { Modal } from "../common/Modal";

export interface GameStats {
  totalMoves: number;
  hits: number;
  misses: number;
  accuracy: number;
  shipsLost: number;
  totalShips: number;
}

interface GameEndModalProps {
  isOpen: boolean;
  isWinner: boolean;
  opponentName: string;
  stats?: GameStats;
  gamePoints?: number;
  totalPoints?: number;
  onPlayAgain?: () => void;
}

export function GameEndModal({
  isOpen,
  isWinner,
  opponentName,
  stats,
  gamePoints,
  totalPoints,
  onPlayAgain,
}: GameEndModalProps) {
  const navigate = useNavigate();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => navigate("/lobby")}
      title={isWinner ? "Victory!" : "Defeat"}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <span className="text-5xl">{isWinner ? "🎉" : "💥"}</span>
        <p className="text-center text-slate-200">
          {isWinner
            ? `You sank all of ${opponentName}'s ships${stats ? ` in ${stats.totalMoves} moves` : ""}!`
            : `${opponentName} sank all your ships.`}
        </p>

        {/* Points earned this game */}
        {gamePoints !== undefined && (
          <div className="flex w-full items-center justify-between rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="text-sm font-medium text-amber-200">Points Earned</span>
            </div>
            <span className={`text-lg font-bold ${gamePoints > 0 ? "text-amber-400" : "text-slate-500"}`}>
              +{gamePoints}
            </span>
          </div>
        )}

        {totalPoints !== undefined && (
          <div className="flex w-full items-center justify-between rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <span className="text-sm font-medium text-blue-200">Total Score</span>
            </div>
            <span className="text-lg font-bold text-blue-400">
              {totalPoints.toLocaleString()}
            </span>
          </div>
        )}

        {stats && (
          <div className="grid w-full grid-cols-2 gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-emerald-400">{stats.hits}</span>
              <span className="text-xs text-slate-400">Hits</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-slate-300">{stats.misses}</span>
              <span className="text-xs text-slate-400">Misses</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-blue-400">{stats.accuracy}%</span>
              <span className="text-xs text-slate-400">Accuracy</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-red-400">{stats.shipsLost}/{stats.totalShips}</span>
              <span className="text-xs text-slate-400">Ships Sank</span>
            </div>
          </div>
        )}

        {gamePoints !== undefined && (
          <div className="grid w-full grid-cols-2 gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-sm">
            <div className="flex flex-col items-center">
              <span className={`text-lg font-bold ${gamePoints > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>+{gamePoints}</span>
              <span className="text-xs text-slate-400">Points Earned</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-amber-400">{(totalPoints ?? 0).toLocaleString()}</span>
              <span className="text-xs text-slate-400">Total Score</span>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-3">
          {onPlayAgain && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/lobby")}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    </Modal>
  );
}
