import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import type { CellState, Orientation } from "../types";
import {
  MAX_SHIP_COUNT,
  MIN_SHIP_COUNT,
  areCellsInBounds,
  createFleetState,
  getShipCells,
  hasOverlap
} from "../game/shipRules";

function emptyBoard(): CellState[][] {
  return Array.from({ length: 10 }, () =>
    Array.from<CellState>({ length: 10 }).fill("empty")
  );
}

function boardFromFleet(
  fleet: ReturnType<typeof createFleetState>
): CellState[][] {
  const board = emptyBoard();
  for (const ship of fleet) {
    for (const cell of ship.cells) {
      board[cell.y][cell.x] = "ship";
    }
  }
  return board;
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

  const [shipCount, setShipCount] = useState<number>(5);
  const [fleet, setFleet] = useState(() => createFleetState(5));
  const [selectedShipId, setSelectedShipId] = useState<string>("ship-1");
  const [draggedShipId, setDraggedShipId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, "valid" | "invalid">>({});

  const [myBoard, setMyBoard] = useState<CellState[][]>(() =>
    boardFromFleet(createFleetState(5))
  );
  const [opponentBoard, setOpponentBoard] =
    useState<CellState[][]>(demoOpponentBoard);

  const [myInfo, setMyInfo] = useState<PlayerInfo | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId || !user) return;
    const currentUserId = user.id;

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
              displayName: profile.display_name ?? "Unknown"
            };
            if (profile.id === currentUserId) {
              setMyInfo(info);
            } else {
              setOpponentInfo(info);
            }
          }
        }
      } catch {
        // Header falls back to default labels.
      } finally {
        setLoading(false);
      }
    }

    fetchPlayers();
  }, [gameId, user]);

  const handleShipCountChange = (nextShipCount: number) => {
    const nextFleet = createFleetState(nextShipCount);
    setShipCount(nextShipCount);
    setFleet(nextFleet);
    setMyBoard(boardFromFleet(nextFleet));
    setSelectedShipId("ship-1");
    setDraggedShipId(null);
    setPreviewMap({});
    setPlacementError(null);
  };

  const handleRotate = () => {
    setOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
    setPreviewMap({});
    setPlacementError(null);
  };

  const placeShipAt = (shipId: string, row: number, col: number) => {
    const selectedShip = fleet.find((ship) => ship.id === shipId);
    if (!selectedShip) {
      setPlacementError("Select an unplaced ship first.");
      return;
    }

    const candidateCells = getShipCells(row, col, selectedShip.size, orientation);

    if (!areCellsInBounds(candidateCells)) {
      setPlacementError("Out of bounds: move start cell or rotate the ship.");
      return;
    }

    if (hasOverlap(fleet, candidateCells, selectedShip.id)) {
      setPlacementError("Invalid placement: ships cannot overlap.");
      return;
    }

    setFleet((prev) => {
      const nextFleet = prev.map((ship) =>
        ship.id === shipId
          ? { ...ship, orientation, cells: candidateCells }
          : ship
      );
      setMyBoard(boardFromFleet(nextFleet));

      const nextUnplaced = nextFleet.find((ship) => ship.cells.length === 0);
      setSelectedShipId(nextUnplaced?.id ?? shipId);
      return nextFleet;
    });

    setPlacementError(null);
  };

  const handleMyBoardCellClick = (row: number, col: number) => {
    placeShipAt(selectedShipId, row, col);
  };

  const handleMyBoardCellDrop = (row: number, col: number) => {
    const shipId = draggedShipId ?? selectedShipId;
    placeShipAt(shipId, row, col);
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragStart = (row: number, col: number) => {
    const shipAtCell = fleet.find((ship) =>
      ship.cells.some((cell) => cell.y === row && cell.x === col)
    );

    if (!shipAtCell) return;
    setSelectedShipId(shipAtCell.id);
    setDraggedShipId(shipAtCell.id);
    setPlacementError(null);
  };

  const handleMyBoardCellDragEnd = () => {
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragOver = (row: number, col: number) => {
    const shipId = draggedShipId ?? selectedShipId;
    const selectedShip = fleet.find((ship) => ship.id === shipId);
    if (!selectedShip) return;

    const candidateCells = getShipCells(row, col, selectedShip.size, orientation);
    const inBounds = areCellsInBounds(candidateCells);
    const overlap = hasOverlap(fleet, candidateCells, selectedShip.id);
    const status: "valid" | "invalid" = inBounds && !overlap ? "valid" : "invalid";

    const nextPreview: Record<string, "valid" | "invalid"> = {};
    candidateCells.forEach((cell) => {
      if (cell.x >= 0 && cell.x < 10 && cell.y >= 0 && cell.y < 10) {
        nextPreview[`${cell.y},${cell.x}`] = status;
      }
    });
    setPreviewMap(nextPreview);
  };

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
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            {loading ? (
              <span className="inline-block h-6 w-48 animate-pulse rounded bg-slate-800" />
            ) : (
              <>
                <span className="text-blue-400">{myInfo?.displayName ?? "You"}</span>
                <span className="text-slate-500">vs</span>
                <span className="text-red-400">{opponentInfo?.displayName ?? "Opponent"}</span>
              </>
            )}
          </h1>
          <Link
            to="/lobby"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Lobby
          </Link>
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Ship Placement
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            Drag a ship onto your board (or click a ship then click a cell).
            Choose orientation before placement.
            Ships must stay inside the 10x10 grid and cannot overlap.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {fleet.map((ship) => {
              const isPlaced = ship.cells.length > 0;
              const isSelected = selectedShipId === ship.id;
              return (
                <button
                  key={ship.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setSelectedShipId(ship.id);
                    setDraggedShipId(ship.id);
                    event.dataTransfer.setData("text/plain", ship.id);
                    event.dataTransfer.effectAllowed = "move";
                    setPlacementError(null);
                  }}
                  onDragEnd={() => {
                    setDraggedShipId(null);
                    setPreviewMap({});
                  }}
                  onClick={() => {
                    setSelectedShipId(ship.id);
                    setDraggedShipId(null);
                    setPreviewMap({});
                    setPlacementError(null);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "border-blue-400 bg-blue-600/20 text-blue-200"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  {ship.id} (1x{ship.size}) {isPlaced ? "Placed" : "Unplaced"}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRotate}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:border-slate-500"
            >
              Rotate: {orientation}
            </button>
            <span className="text-xs text-slate-400">Selected: {selectedShipId}</span>
          </div>

          {placementError && (
            <p className="mt-3 rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {placementError}
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 place-items-center">
          <BoardGrid
            cells={myBoard}
            interactive
            onCellClick={handleMyBoardCellClick}
            onCellDrop={handleMyBoardCellDrop}
            onCellDragOver={handleMyBoardCellDragOver}
            onCellDragStart={handleMyBoardCellDragStart}
            onCellDragEnd={handleMyBoardCellDragEnd}
            previewMap={previewMap}
            title={myInfo?.displayName ?? "Your Fleet"}
          />
          <BoardGrid
            cells={opponentBoard}
            onCellClick={handleOpponentCellClick}
            title={opponentInfo?.displayName ?? "Opponent's Waters"}
          />
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Fleet Rule Validation
            </h2>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Ship Count
              <select
                value={shipCount}
                onChange={(e) => handleShipCountChange(Number(e.target.value))}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              >
                {Array.from(
                  { length: MAX_SHIP_COUNT - MIN_SHIP_COUNT + 1 },
                  (_, i) => i + MIN_SHIP_COUNT
                ).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Rule: selecting N ships creates ships of sizes 1..N.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {fleet.map((ship) => (
              <span
                key={ship.id}
                className="rounded-md border border-blue-500/30 bg-blue-950/30 px-2.5 py-1 text-xs text-blue-300"
              >
                {ship.id}: 1x{ship.size}
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-4 text-[10px] sm:text-xs text-slate-400">
          {[
            { color: "bg-slate-800", label: "Empty" },
            { color: "bg-blue-600", label: "Ship" },
            { color: "bg-red-600", label: "Hit" },
            { color: "bg-slate-700", label: "Miss" },
            { color: "bg-red-900", label: "Sunk" }
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
