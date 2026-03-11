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
  onPlayAgain?: () => void;
}

export function GameEndModal({
  isOpen,
  isWinner,
  opponentName,
  stats,
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
