import { useState } from "react";
import { useParams, Link } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import { TurnIndicator } from "../components/game/TurnIndicator";
import { GameEndModal } from "../components/game/GameEndModal";
import { useAuth } from "../hooks/useAuth";
import { useGame } from "../hooks/useGame";
import type { Orientation } from "../types";
import {
  MAX_SHIP_COUNT,
  MIN_SHIP_COUNT,
  areCellsInBounds,
  createFleetState,
  getShipCells,
  getShipName,
  hasOverlap,
} from "../game/shipRules";
import { boardFromFleet } from "../lib/gameLogic";

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  // ── Ship placement state ────────────────────────────────────────────
  const [shipCount, setShipCount] = useState<number>(5);
  const [fleet, setFleet] = useState(() => createFleetState(5));
  const [selectedShipId, setSelectedShipId] = useState<string>("ship-1");
  const [draggedShipId, setDraggedShipId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, "valid" | "invalid">>({});
  const [submittingReady, setSubmittingReady] = useState(false);

  // ── Game hook ───────────────────────────────────────────────────────
  const {
    gameStatus,
    isMyTurn,
    myBoard: gameBoardMy,
    opponentBoard: gameBoardOpp,
    myInfo,
    opponentInfo,
    myPlayer,
    winnerId,
    loading,
    error,
    submitReady,
    attack,
  } = useGame(gameId);

  // During setup, show the fleet placement board. After ready, show game boards.
  const isSetup = gameStatus === "setup";
  const isPlaying = gameStatus === "in_progress";
  const isFinished = gameStatus === "finished" || gameStatus === "abandoned";
  const allShipsPlaced = fleet.every((s) => s.cells.length > 0);
  const isReady = myPlayer?.ready ?? false;

  // Board to display for "my" side
  const myDisplayBoard = isSetup && !isReady ? boardFromFleet(fleet) : gameBoardMy;

  // ── Ship placement handlers ─────────────────────────────────────────
  const handleShipCountChange = (nextShipCount: number) => {
    const nextFleet = createFleetState(nextShipCount);
    setShipCount(nextShipCount);
    setFleet(nextFleet);
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

      const nextUnplaced = nextFleet.find((ship) => ship.cells.length === 0);
      setSelectedShipId(nextUnplaced?.id ?? shipId);
      return nextFleet;
    });

    setPlacementError(null);
  };

  const handleMyBoardCellClick = (row: number, col: number) => {
    if (isSetup && !isReady) {
      placeShipAt(selectedShipId, row, col);
    }
  };

  const handleMyBoardCellDrop = (row: number, col: number) => {
    if (!isSetup || isReady) return;
    const shipId = draggedShipId ?? selectedShipId;
    placeShipAt(shipId, row, col);
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragStart = (row: number, col: number) => {
    if (!isSetup || isReady) return;
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
    if (!isSetup || isReady) return;
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

  // ── Ready button ────────────────────────────────────────────────────
  const handleReady = async () => {
    if (!allShipsPlaced || submittingReady) return;
    setSubmittingReady(true);
    try {
      await submitReady(fleet);
    } catch {
      setPlacementError("Failed to submit board. Please try again.");
    } finally {
      setSubmittingReady(false);
    }
  };

  // ── Attack handler ──────────────────────────────────────────────────
  const handleOpponentCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;
    attack(row, col);
  };

  // ── Render ──────────────────────────────────────────────────────────
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

        {/* Error banner */}
        {error && (
          <p className="rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {/* Turn indicator (only during gameplay) */}
        {isPlaying && (
          <TurnIndicator
            isMyTurn={isMyTurn}
            opponentName={opponentInfo?.displayName ?? "Opponent"}
          />
        )}

        {/* Waiting for opponent ready (setup phase, I'm ready) */}
        {isSetup && isReady && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-center text-sm text-blue-300">
            Your fleet is locked in. Waiting for opponent to ready up...
          </div>
        )}

        {/* Ship placement UI (setup phase, not yet ready) */}
        {isSetup && !isReady && (
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
                    {getShipName(ship.size)} (1x{ship.size}) {isPlaced ? "Placed" : "Unplaced"}
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
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Ships
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
              <span className="text-xs text-slate-400">
                Selected: {getShipName(fleet.find((s) => s.id === selectedShipId)?.size ?? 1)}
              </span>
            </div>

            {placementError && (
              <p className="mt-3 rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {placementError}
              </p>
            )}

            {/* Ready button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleReady}
                disabled={!allShipsPlaced || submittingReady}
                className={`rounded-lg px-6 py-2 text-sm font-semibold transition-colors ${
                  allShipsPlaced && !submittingReady
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
              >
                {submittingReady ? "Submitting..." : allShipsPlaced ? "Ready!" : "Place all ships first"}
              </button>
            </div>
          </section>
        )}

        {/* Game boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 place-items-center">
          <BoardGrid
            cells={myDisplayBoard}
            interactive={isSetup && !isReady}
            onCellClick={handleMyBoardCellClick}
            onCellDrop={handleMyBoardCellDrop}
            onCellDragOver={handleMyBoardCellDragOver}
            onCellDragStart={handleMyBoardCellDragStart}
            onCellDragEnd={handleMyBoardCellDragEnd}
            previewMap={isSetup && !isReady ? previewMap : undefined}
            title={myInfo?.displayName ?? "Your Fleet"}
          />
          <BoardGrid
            cells={gameBoardOpp}
            interactive={isMyTurn}
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

        {/* Game end modal */}
        {isFinished && user && (
          <GameEndModal
            isOpen
            isWinner={winnerId === user.id}
            opponentName={opponentInfo?.displayName ?? "Opponent"}
          />
        )}
      </div>
    </main>
  );
}
