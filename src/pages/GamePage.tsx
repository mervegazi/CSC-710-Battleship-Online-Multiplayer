import { useState } from "react";
import { useParams, Link } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import type { CellState } from "../types";

/** Build a blank 10×10 board */
function emptyBoard(): CellState[][] {
  return Array.from({ length: 10 }, () =>
    Array.from<CellState>({ length: 10 }).fill("empty"),
  );
}

/** Demo board — showcases every cell state */
function demoMyBoard(): CellState[][] {
  const b = emptyBoard();
  // Carrier (5 cells, row 1)
  for (let c = 2; c <= 6; c++) b[0][c] = "ship";
  // Battleship (4 cells, row 3)
  for (let c = 0; c <= 3; c++) b[2][c] = "ship";
  // A hit on my ship
  b[2][1] = "hit";
  // Destroyer (2 cells, col J)
  b[7][9] = "ship";
  b[8][9] = "ship";
  b[8][9] = "sunk"; // mark as sunk
  b[7][9] = "sunk";
  // Some misses the opponent made
  b[4][4] = "miss";
  b[5][6] = "miss";
  return b;
}

function demoOpponentBoard(): CellState[][] {
  const b = emptyBoard();
  b[1][3] = "hit";
  b[1][4] = "hit";
  b[3][7] = "miss";
  b[6][2] = "miss";
  b[9][0] = "hit";
  return b;
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();

  const [myBoard] = useState<CellState[][]>(demoMyBoard);
  const [opponentBoard, setOpponentBoard] =
    useState<CellState[][]>(demoOpponentBoard);

  const handleOpponentCellClick = (row: number, col: number) => {
    setOpponentBoard((prev) => {
      const next = prev.map((r) => [...r]);
      if (next[row][col] === "empty") {
        next[row][col] = "miss"; // demo: mark as miss
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Game #{gameId}</h1>
          <Link
            to="/lobby"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Lobby
          </Link>
        </div>

        {/* Boards — side-by-side on ≥ md, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 place-items-center">
          <BoardGrid
            cells={myBoard}
            interactive={false}
            title="Your Fleet"
          />
          <BoardGrid
            cells={opponentBoard}
            onCellClick={handleOpponentCellClick}
            title="Opponent's Waters"
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-[10px] sm:text-xs text-slate-400">
          {[
            { color: "bg-slate-800", label: "Empty" },
            { color: "bg-blue-600", label: "Ship" },
            { color: "bg-red-600", label: "Hit" },
            { color: "bg-slate-700", label: "Miss" },
            { color: "bg-red-900", label: "Sunk" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
