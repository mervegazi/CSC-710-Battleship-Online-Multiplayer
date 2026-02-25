import { useNavigate } from "react-router";
import { Modal } from "../common/Modal";

interface GameEndModalProps {
  isOpen: boolean;
  isWinner: boolean;
  opponentName: string;
}

export function GameEndModal({
  isOpen,
  isWinner,
  opponentName,
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
            ? `You sank all of ${opponentName}'s ships!`
            : `${opponentName} sank all your ships.`}
        </p>
        <button
          type="button"
          onClick={() => navigate("/lobby")}
          className="mt-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Return to Lobby
        </button>
      </div>
    </Modal>
  );
}
