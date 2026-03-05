import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import { TurnIndicator } from "../components/game/TurnIndicator";
import { GameEndModal } from "../components/game/GameEndModal";
import type { GameStats } from "../components/game/GameEndModal";
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
  hydrateFleetFromBoard,
} from "../game/shipRules";
import { boardFromFleet } from "../lib/gameLogic";

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [shipCount, setShipCount] = useState<number>(5);
  const [fleet, setFleet] = useState(() => createFleetState(5));
  const [selectedShipId, setSelectedShipId] = useState<string>("ship-1");
  const [draggedShipId, setDraggedShipId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, "valid" | "invalid">>({});
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [leavingMatch, setLeavingMatch] = useState(false);
  const [showOpponentLeftPopup, setShowOpponentLeftPopup] = useState(false);
  const [turnLockedShipSize, setTurnLockedShipSize] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"my" | "enemy">("my");
  const wasMyPlacementTurnRef = useRef(false);

  const {
    gameStatus,
    currentTurnPlayerId,
    isMyTurn,
    myBoard: gameBoardMy,
    opponentBoard: gameBoardOpp,
    myInfo,
    opponentInfo,
    myPlayer,
    opponentPlayer,
    winnerId,
    loading,
    error,
    moves: gameMoves,
    connectionStatus,
    gameShipCount,
    opponentConnected,
    endPlacementTurn,
    abandonGame,
    attack,
  } = useGame(gameId);

  const isSetup = gameStatus === "setup";
  const isPlaying = gameStatus === "in_progress";
  const isFinished = gameStatus === "finished";
  const isReady = myPlayer?.ready ?? false;

  // ── Opponent disconnect countdown ─────────────────────────────────
  const DISCONNECT_COUNTDOWN = 30; // seconds
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setDisconnectCountdown(null);
  }, []);

  useEffect(() => {
    const isActive = gameStatus === "setup" || gameStatus === "in_progress";

    if (!opponentConnected && isActive) {
      // Start countdown if not already running
      if (disconnectCountdown === null) {
        setDisconnectCountdown(DISCONNECT_COUNTDOWN);
        countdownRef.current = setInterval(() => {
          setDisconnectCountdown((prev) => {
            if (prev === null || prev <= 1) {
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      // Opponent reconnected or game is no longer active — cancel countdown
      clearCountdown();
    }

    return () => {
      // Cleanup only on unmount, not on every re-render
    };
  }, [opponentConnected, gameStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-end game when countdown reaches 0
  useEffect(() => {
    if (disconnectCountdown === 0) {
      clearCountdown();
      // Abandon game — current user wins
      abandonGame().then(() => {
        navigate("/lobby", {
          replace: true,
          state: { notice: "Opponent disconnected. You win!" },
        });
      });
    }
  }, [disconnectCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const myPlacedCount = useMemo(
    () => fleet.filter((ship) => ship.cells.length > 0).length,
    [fleet]
  );
  const opponentPlacedCount = useMemo(
    () => opponentPlayer?.board?.ships?.length ?? 0,
    [opponentPlayer]
  );
  const nextPlacementSize = useMemo(
    () => Math.min(myPlacedCount, opponentPlacedCount) + 1,
    [myPlacedCount, opponentPlacedCount]
  );
  const requiredShipSize = turnLockedShipSize ?? nextPlacementSize;
  const activeShip = useMemo(
    () => fleet.find((ship) => ship.size === requiredShipSize) ?? null,
    [fleet, requiredShipSize]
  );

  const allShipsPlaced = fleet.every((ship) => ship.cells.length > 0);
  const isMyPlacementTurn =
    isSetup && !isReady && !!user && currentTurnPlayerId === user.id;
  const shipCountLocked = myPlacedCount > 0 || opponentPlacedCount > 0;
  const canEndTurn =
    isMyPlacementTurn &&
    !!activeShip &&
    activeShip.cells.length === activeShip.size &&
    !submittingTurn;

  const myDisplayBoard = isSetup && !isReady ? boardFromFleet(fleet) : gameBoardMy;

  const endStats = useMemo<GameStats | null>(() => {
    if (!isFinished || !user) return null;
    const myMoves = gameMoves.filter((m) => m.player_id === user.id);
    const hits = myMoves.filter((m) => m.result === "hit" || m.result === "sunk").length;
    const misses = myMoves.filter((m) => m.result === "miss").length;
    const totalShips = myPlayer?.board?.ships?.length ?? 0;
    const shipsLost = myPlayer?.board?.ships?.filter((s) => s.sunk).length ?? 0;
    return {
      totalMoves: myMoves.length,
      hits,
      misses,
      accuracy: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
      shipsLost,
      totalShips,
    };
  }, [isFinished, user, gameMoves, myPlayer]);

  // Sync local shipCount with DB value when opponent has already locked it
  useEffect(() => {
    if (gameShipCount !== shipCount) {
      setShipCount(gameShipCount);
      setFleet(createFleetState(gameShipCount));
    }
  }, [gameShipCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!myPlayer) return;
    const hydrated = hydrateFleetFromBoard(shipCount, myPlayer.board);
    setFleet(hydrated);
  }, [myPlayer, shipCount]);

  useEffect(() => {
    if (!activeShip) return;
    setSelectedShipId(activeShip.id);
  }, [activeShip]);

  useEffect(() => {
    if (isMyPlacementTurn && !wasMyPlacementTurnRef.current) {
      setTurnLockedShipSize(nextPlacementSize);
    }
    if (!isMyPlacementTurn && wasMyPlacementTurnRef.current) {
      setTurnLockedShipSize(null);
    }
    wasMyPlacementTurnRef.current = isMyPlacementTurn;
  }, [isMyPlacementTurn, nextPlacementSize]);

  useEffect(() => {
    if (gameStatus !== "abandoned" || !user) return;
    if (leavingMatch) return;
    if (winnerId !== user.id) return;
    setShowOpponentLeftPopup(true);
  }, [gameStatus, user, winnerId, leavingMatch]);

  const handleShipCountChange = (nextShipCount: number) => {
    if (shipCountLocked) return;
    const nextFleet = createFleetState(nextShipCount);
    setShipCount(nextShipCount);
    setFleet(nextFleet);
    setSelectedShipId("ship-1");
    setDraggedShipId(null);
    setPreviewMap({});
    setPlacementError(null);
  };

  const handleRotate = () => {
    if (!isMyPlacementTurn) return;
    setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
    setPreviewMap({});
    setPlacementError(null);
  };

  const placeShipAt = (shipId: string, row: number, col: number) => {
    if (!isMyPlacementTurn) {
      setPlacementError("Wait for your placement turn.");
      return;
    }

    const ship = fleet.find((s) => s.id === shipId);
    if (!ship) {
      setPlacementError("Select a ship first.");
      return;
    }

    if (ship.size !== requiredShipSize) {
      setPlacementError(`Place your 1x${requiredShipSize} ship this turn.`);
      return;
    }

    const candidateCells = getShipCells(row, col, ship.size, orientation);

    if (!areCellsInBounds(candidateCells)) {
      setPlacementError("Out of bounds: move start cell or rotate the ship.");
      return;
    }

    if (hasOverlap(fleet, candidateCells, ship.id)) {
      setPlacementError("Invalid placement: ships cannot overlap.");
      return;
    }

    setFleet((prev) =>
      prev.map((s) =>
        s.id === ship.id ? { ...s, orientation, cells: candidateCells } : s
      )
    );

    setPlacementError(null);
  };

  const handleMyBoardCellClick = (row: number, col: number) => {
    if (!isMyPlacementTurn) return;
    placeShipAt(selectedShipId, row, col);
  };

  const handleMyBoardCellDrop = (row: number, col: number) => {
    if (!isMyPlacementTurn) return;
    const shipId = draggedShipId ?? selectedShipId;
    placeShipAt(shipId, row, col);
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragStart = (row: number, col: number) => {
    if (!isMyPlacementTurn) return;

    const shipAtCell = fleet.find((ship) =>
      ship.cells.some((cell) => cell.y === row && cell.x === col)
    );

    if (!shipAtCell) return;

    if (shipAtCell.size !== requiredShipSize) {
      setPlacementError(`Only your 1x${requiredShipSize} ship can be moved this turn.`);
      return;
    }

    setSelectedShipId(shipAtCell.id);
    setDraggedShipId(shipAtCell.id);
    setPlacementError(null);
  };

  const handleMyBoardCellDragEnd = () => {
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragOver = (row: number, col: number) => {
    if (!isMyPlacementTurn) return;

    const shipId = draggedShipId ?? selectedShipId;
    const ship = fleet.find((s) => s.id === shipId);
    if (!ship) return;

    const candidateCells = getShipCells(row, col, ship.size, orientation);
    const inBounds = areCellsInBounds(candidateCells);
    const overlap = hasOverlap(fleet, candidateCells, ship.id);
    const status: "valid" | "invalid" = inBounds && !overlap ? "valid" : "invalid";

    const nextPreview: Record<string, "valid" | "invalid"> = {};
    for (const cell of candidateCells) {
      if (cell.x >= 0 && cell.x < 10 && cell.y >= 0 && cell.y < 10) {
        nextPreview[`${cell.y},${cell.x}`] = status;
      }
    }
    setPreviewMap(nextPreview);
  };

  const handleEndPlacementTurn = async () => {
    if (!canEndTurn || !activeShip) return;

    setSubmittingTurn(true);
    try {
      await endPlacementTurn(fleet, activeShip.size, shipCount);
      setPlacementError(null);
      setPreviewMap({});
      setDraggedShipId(null);
    } catch {
      setPlacementError("Failed to end turn. Please try again.");
    } finally {
      setSubmittingTurn(false);
    }
  };

  const handleOpponentCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;
    attack(row, col);
  };

  const handleLeaveMatch = async () => {
    if (leavingMatch) return;
    setLeavingMatch(true);
    try {
      await abandonGame();
    } finally {
      navigate("/lobby", {
        replace: true,
        state: { notice: "You left the match." },
      });
    }
  };

  const handleReturnToLobbyAfterOpponentLeft = () => {
    setShowOpponentLeftPopup(false);
    navigate("/lobby", {
      replace: true,
      state: { notice: `${opponentInfo?.displayName ?? "Opponent"} left the match.` },
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
                {(isSetup || isPlaying) && (
                  <span
                    className="text-base ml-1"
                    title={opponentConnected ? "Opponent connected" : "Opponent disconnected"}
                    style={opponentConnected ? { animation: "heartbeat 1.5s ease-in-out infinite" } : {}}
                  >
                    {opponentConnected ? "💚" : "🔴"}
                  </span>
                )}
              </>
            )}
          </h1>
          <button
            type="button"
            onClick={handleLeaveMatch}
            disabled={leavingMatch}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {leavingMatch ? "Leaving..." : "Back to Lobby"}
          </button>
        </div>

        {connectionStatus === "disconnected" && (
          <div className="rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Connection lost. Attempting to reconnect...
          </div>
        )}

        {!opponentConnected && (gameStatus === "setup" || gameStatus === "in_progress") && (
          <div className="rounded-lg border-2 border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-200 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold">Opponent Disconnected!</p>
              <p className="text-xs text-red-300 mt-0.5">
                Game will automatically end in{" "}
                <span className="font-bold text-white text-sm">{disconnectCountdown ?? "—"}</span>{" "}
                seconds if they don't reconnect.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {isPlaying && (
          <TurnIndicator
            isMyTurn={isMyTurn}
            opponentName={opponentInfo?.displayName ?? "Opponent"}
          />
        )}

        {isSetup && isReady && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-center text-sm text-blue-300">
            Your fleet is locked in. Waiting for opponent to finish placement...
          </div>
        )}

        {isSetup && !isReady && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Alternating Ship Placement
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Players place one ship per turn in order: 1x1, 1x2, 1x3, and so on.
            </p>

            <div className="mt-3 rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
              {isMyPlacementTurn ? (
                <span className="font-semibold text-emerald-300">
                  Your turn: place {getShipName(requiredShipSize)} (1x{requiredShipSize}).
                </span>
              ) : (
                <span className="font-semibold text-amber-300">
                  Opponent turn: waiting for {opponentInfo?.displayName ?? "opponent"} to place 1x{nextPlacementSize}.
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {fleet.map((ship) => {
                const isPlaced = ship.cells.length > 0;
                const isCurrentTurnShip = ship.size === requiredShipSize;
                const isSelected = selectedShipId === ship.id || isCurrentTurnShip;

                return (
                  <button
                    key={ship.id}
                    type="button"
                    draggable={isMyPlacementTurn && isCurrentTurnShip}
                    onDragStart={(event) => {
                      if (!isMyPlacementTurn || !isCurrentTurnShip) {
                        event.preventDefault();
                        return;
                      }
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
                      if (!isMyPlacementTurn || !isCurrentTurnShip) return;
                      setSelectedShipId(ship.id);
                      setDraggedShipId(null);
                      setPreviewMap({});
                      setPlacementError(null);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${isSelected
                      ? "border-blue-400 bg-blue-600/20 text-blue-200"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
                      }`}
                  >
                    {getShipName(ship.size)} (1x{ship.size}) {isPlaced ? "Placed" : "Unplaced"}
                    {isCurrentTurnShip ? " - Current Turn" : ""}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRotate}
                disabled={!isMyPlacementTurn}
                className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Rotate: {orientation}
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Ships
                <select
                  value={shipCount}
                  onChange={(e) => handleShipCountChange(Number(e.target.value))}
                  disabled={shipCountLocked}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                Selected: {getShipName(activeShip?.size ?? 1)}
              </span>
            </div>

            {placementError && (
              <p className="mt-3 rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {placementError}
              </p>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={handleEndPlacementTurn}
                disabled={!canEndTurn}
                className={`rounded-lg px-6 py-2 text-sm font-semibold transition-colors ${canEndTurn
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
                  }`}
              >
                {submittingTurn
                  ? "Ending Turn..."
                  : allShipsPlaced
                    ? "End Turn & Finish Placement"
                    : `End Turn (after placing 1x${requiredShipSize})`}
              </button>
            </div>
          </section>
        )}

        {/* ── Mobile Tab Switcher (visible only on small screens) ── */}
        <div className="flex md:hidden rounded-lg border border-slate-700 bg-slate-900 p-1 gap-1">
          <button
            type="button"
            onClick={() => setMobileTab("my")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${mobileTab === "my"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
          >
            🛳️ My Board
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("enemy")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${mobileTab === "enemy"
              ? "bg-red-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
          >
            🎯 Enemy Board
          </button>
        </div>

        {/* ── Desktop: side-by-side boards ── */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 md:gap-10 place-items-center">
          <BoardGrid
            cells={myDisplayBoard}
            interactive={isMyPlacementTurn}
            onCellClick={handleMyBoardCellClick}
            onCellDrop={handleMyBoardCellDrop}
            onCellDragOver={handleMyBoardCellDragOver}
            onCellDragStart={handleMyBoardCellDragStart}
            onCellDragEnd={handleMyBoardCellDragEnd}
            previewMap={isMyPlacementTurn ? previewMap : undefined}
            title={myInfo?.displayName ?? "Your Fleet"}
          />
          <BoardGrid
            cells={gameBoardOpp}
            interactive={isMyTurn}
            onCellClick={handleOpponentCellClick}
            title={opponentInfo?.displayName ?? "Opponent's Waters"}
          />
        </div>

        {/* ── Mobile: tabbed single board ── */}
        <div className="md:hidden flex flex-col items-center justify-start py-2">
          {mobileTab === "my" ? (
            <BoardGrid
              cells={myDisplayBoard}
              interactive={isMyPlacementTurn}
              onCellClick={handleMyBoardCellClick}
              onCellDrop={handleMyBoardCellDrop}
              onCellDragOver={handleMyBoardCellDragOver}
              onCellDragStart={handleMyBoardCellDragStart}
              onCellDragEnd={handleMyBoardCellDragEnd}
              previewMap={isMyPlacementTurn ? previewMap : undefined}
              title={myInfo?.displayName ?? "Your Fleet"}
            />
          ) : (
            <BoardGrid
              cells={gameBoardOpp}
              interactive={isMyTurn}
              onCellClick={handleOpponentCellClick}
              title={opponentInfo?.displayName ?? "Opponent's Waters"}
            />
          )}
        </div>

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

        {isFinished && user && endStats && (
          <GameEndModal
            isOpen
            isWinner={winnerId === user.id}
            opponentName={opponentInfo?.displayName ?? "Opponent"}
            stats={endStats}
            onPlayAgain={() => navigate("/lobby", { state: { quickMatch: true } })}
          />
        )}

        {showOpponentLeftPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-amber-500/40 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-amber-300">
                Opponent Left Match
              </h2>
              <p className="mt-3 text-sm text-slate-200">
                {opponentInfo?.displayName ?? "The other player"} left the game.
              </p>
              <button
                type="button"
                onClick={handleReturnToLobbyAfterOpponentLeft}
                className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
