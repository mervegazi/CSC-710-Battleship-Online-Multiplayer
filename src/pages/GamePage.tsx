import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
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
  for (let c = 2; c <= 6; c++) b[0][c] = "ship";
  for (let c = 0; c <= 3; c++) b[2][c] = "ship";
  b[2][1] = "hit";
  b[7][9] = "sunk";
  b[8][9] = "sunk";
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

interface PlayerInfo {
  id: string;
  displayName: string;
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [myBoard] = useState<CellState[][]>(demoMyBoard);
  const [opponentBoard, setOpponentBoard] =
    useState<CellState[][]>(demoOpponentBoard);

  const [myInfo, setMyInfo] = useState<PlayerInfo | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch both players' names from Supabase
  useEffect(() => {
    if (!gameId || !user) return;

    async function fetchPlayers() {
      try {
        const { data: players } = await supabase
          .from("games_players")
          .select("player_id")
          .eq("game_id", gameId);

        if (!players || players.length === 0) {
          setLoading(false);
          return;
        }

        const playerIds = players.map((p) => p.player_id);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", playerIds);

        if (profiles) {
          for (const profile of profiles) {
            const info: PlayerInfo = {
              id: profile.id,
              displayName: profile.display_name ?? "Unknown",
            };
            if (profile.id === user!.id) {
              setMyInfo(info);
            } else {
              setOpponentInfo(info);
            }
          }
        }
      } catch {
        // Silently fail — header will show fallback
      } finally {
        setLoading(false);
      }
    }

    fetchPlayers();
  }, [gameId, user]);

  const handleOpponentCellClick = (row: number, col: number) => {
    setOpponentBoard((prev) => {
      const next = prev.map((r) => [...r]);
      if (next[row][col] === "empty") {
        next[row][col] = "miss";
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            {loading ? (
              <span className="inline-block h-6 w-48 animate-pulse rounded bg-slate-800" />
            ) : (
              <>
                <span className="text-blue-400">{myInfo?.displayName ?? "You"}</span>
                <span className="text-slate-500">⚔️</span>
                <span className="text-red-400">{opponentInfo?.displayName ?? "Opponent"}</span>
              </>
            )}
          </h1>
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
            title={myInfo?.displayName ?? "Your Fleet"}
          />
          <BoardGrid
            cells={opponentBoard}
            onCellClick={handleOpponentCellClick}
            title={opponentInfo?.displayName ?? "Opponent's Waters"}
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
