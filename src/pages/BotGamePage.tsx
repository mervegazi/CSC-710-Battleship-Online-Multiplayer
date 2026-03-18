import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BoardGrid } from "../components/game/BoardGrid";
import { TurnIndicator } from "../components/game/TurnIndicator";
import { GameEndModal } from "../components/game/GameEndModal";
import type { GameStats } from "../components/game/GameEndModal";
import type { Move, Orientation } from "../types";
import {
  MAX_SHIP_COUNT,
  MIN_SHIP_COUNT,
  areCellsInBounds,
  createFleetState,
  getShipCells,
  getShipName,
  hasOverlap,
} from "../game/shipRules";
import {
  boardFromFleet,
  buildMyDisplay,
  buildOpponentDisplay,
  checkWinByMoves,
  convertFleetToBoard,
  resolveAttack,
} from "../lib/gameLogic";

const VALID_LEVELS = new Set(["easy", "medium", "hard"]);
const BOT_GAME_ID = "bot-match";
const BOT_PLAYER_ID = "bot";
const PLAYER_ID = "player";

export function BotGamePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [shipCount, setShipCount] = useState<number>(5);
  const [fleet, setFleet] = useState(() => createFleetState(5));
  const [botFleet, setBotFleet] = useState(() => createFleetState(5));
  const [selectedShipId, setSelectedShipId] = useState<string>("ship-1");
  const [draggedShipId, setDraggedShipId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, "valid" | "invalid">>({});
  const [phase, setPhase] = useState<"setup" | "in_progress" | "finished">("setup");
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [playerMoves, setPlayerMoves] = useState<Move[]>([]);
  const [botMoves, setBotMoves] = useState<Move[]>([]);
  const [playerMoveNumber, setPlayerMoveNumber] = useState(0);
  const [botMoveNumber, setBotMoveNumber] = useState(0);
  const botThinkingRef = useRef(false);

  const difficulty = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const level = params.get("difficulty")?.toLowerCase() ?? "easy";
    return VALID_LEVELS.has(level) ? level : "easy";
  }, [location.search]);

  const allShipsPlaced = fleet.every((ship) => ship.cells.length > 0);
  const shipCountLocked = phase !== "setup" || fleet.some((ship) => ship.cells.length > 0);
  const playerBoard = useMemo(() => convertFleetToBoard(fleet), [fleet]);
  const botBoard = useMemo(() => convertFleetToBoard(botFleet), [botFleet]);
  const myDisplayBoard = phase === "setup" ? boardFromFleet(fleet) : buildMyDisplay(playerBoard, botMoves);
  const opponentDisplayBoard = useMemo(
    () => buildOpponentDisplay(playerMoves, botBoard),
    [playerMoves, botBoard]
  );

  const endStats = useMemo<GameStats | null>(() => {
    if (phase !== "finished") return null;
    const hits = playerMoves.filter((m) => m.result === "hit" || m.result === "sunk").length;
    const misses = playerMoves.filter((m) => m.result === "miss").length;
    const sunkMoves = playerMoves.filter((m) => m.result === "sunk");
    const sunkTypes = new Set<string>();
    let sunkFallbackCount = 0;
    for (const move of sunkMoves) {
      if (move.sunk_ship) {
        sunkTypes.add(move.sunk_ship);
      } else {
        sunkFallbackCount += 1;
      }
    }
    return {
      totalMoves: playerMoves.length,
      hits,
      misses,
      accuracy: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
      shipsLost: sunkTypes.size + sunkFallbackCount,
      totalShips: botFleet.length,
    };
  }, [phase, playerMoves, botFleet.length]);

  const regenerateBotFleet = useCallback(
    (nextShipCount: number) => {
      const baseFleet = createFleetState(nextShipCount);
      const placed: typeof baseFleet = [];

      for (const ship of baseFleet) {
        let placedShip = false;
        for (let attempt = 0; attempt < 300; attempt += 1) {
          const nextOrientation = Math.random() < 0.5 ? "horizontal" : "vertical";
          const maxRow = nextOrientation === "vertical" ? 10 - ship.size : 9;
          const maxCol = nextOrientation === "horizontal" ? 10 - ship.size : 9;
          const row = Math.floor(Math.random() * (maxRow + 1));
          const col = Math.floor(Math.random() * (maxCol + 1));
          const candidateCells = getShipCells(row, col, ship.size, nextOrientation);

          if (!areCellsInBounds(candidateCells)) continue;
          if (hasOverlap(placed, candidateCells)) continue;

          placed.push({
            ...ship,
            orientation: nextOrientation,
            cells: candidateCells,
          });
          placedShip = true;
          break;
        }
        if (!placedShip) {
          return regenerateBotFleet(nextShipCount);
        }
      }

      setBotFleet(placed);
    },
    []
  );

  useEffect(() => {
    regenerateBotFleet(shipCount);
  }, [shipCount, regenerateBotFleet]);

  const handleShipCountChange = (nextShipCount: number) => {
    if (shipCountLocked) return;
    setShipCount(nextShipCount);
    setFleet(createFleetState(nextShipCount));
    setSelectedShipId("ship-1");
    setDraggedShipId(null);
    setPreviewMap({});
    setPlacementError(null);
    setPlayerMoves([]);
    setBotMoves([]);
    setPlayerMoveNumber(0);
    setBotMoveNumber(0);
    setPhase("setup");
  };

  const handleRotate = () => {
    setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
    setPreviewMap({});
    setPlacementError(null);
  };

  const placeShipAt = (shipId: string, row: number, col: number) => {
    const ship = fleet.find((s) => s.id === shipId);
    if (!ship) {
      setPlacementError("Select a ship first.");
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
    if (phase !== "setup") return;
    placeShipAt(selectedShipId, row, col);
  };

  const handleMyBoardCellDrop = (row: number, col: number) => {
    if (phase !== "setup") return;
    const shipId = draggedShipId ?? selectedShipId;
    placeShipAt(shipId, row, col);
    setDraggedShipId(null);
    setPreviewMap({});
  };

  const handleMyBoardCellDragStart = (row: number, col: number) => {
    if (phase !== "setup") return;

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
    if (phase !== "setup") return;

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

  const startBattle = () => {
    if (!allShipsPlaced) {
      setPlacementError("Place all ships before starting the match.");
      return;
    }
    setPlacementError(null);
    setPhase("in_progress");
    setIsMyTurn(true);
  };

  const handleOpponentCellClick = (row: number, col: number) => {
    if (phase !== "in_progress" || !isMyTurn) return;
    if (playerMoves.some((m) => m.x === col && m.y === row)) return;

    const { result, sunkShip } = resolveAttack(botBoard, col, row, playerMoves);
    const nextMove: Move = {
      id: `p-${playerMoveNumber + 1}-${col}-${row}`,
      game_id: BOT_GAME_ID,
      player_id: PLAYER_ID,
      x: col,
      y: row,
      result,
      sunk_ship: sunkShip?.type ?? null,
      move_number: playerMoveNumber + 1,
      created_at: new Date().toISOString(),
    };
    const nextMoves = [...playerMoves, nextMove];
    setPlayerMoves(nextMoves);
    setPlayerMoveNumber((prev) => prev + 1);

    if (checkWinByMoves(botBoard, nextMoves)) {
      setPhase("finished");
      setIsMyTurn(false);
      return;
    }

    setIsMyTurn(false);
  };

  useEffect(() => {
    if (phase !== "in_progress" || isMyTurn) return;
    if (botThinkingRef.current) return;

    botThinkingRef.current = true;
    const timeout = setTimeout(() => {
      setBotMoves((prev) => {
        const availableCells: { x: number; y: number }[] = [];
        for (let y = 0; y < 10; y += 1) {
          for (let x = 0; x < 10; x += 1) {
            if (!prev.some((m) => m.x === x && m.y === y)) {
              availableCells.push({ x, y });
            }
          }
        }

        if (availableCells.length === 0) {
          botThinkingRef.current = false;
          return prev;
        }

        const target =
          availableCells[Math.floor(Math.random() * availableCells.length)];
        const { result, sunkShip } = resolveAttack(playerBoard, target.x, target.y, prev);

        const nextMove: Move = {
          id: `b-${botMoveNumber + 1}-${target.x}-${target.y}`,
          game_id: BOT_GAME_ID,
          player_id: BOT_PLAYER_ID,
          x: target.x,
          y: target.y,
          result,
          sunk_ship: sunkShip?.type ?? null,
          move_number: botMoveNumber + 1,
          created_at: new Date().toISOString(),
        };
        const nextMoves = [...prev, nextMove];

        if (checkWinByMoves(playerBoard, nextMoves)) {
          setPhase("finished");
          setIsMyTurn(false);
        } else {
          setIsMyTurn(true);
        }

        setBotMoveNumber((count) => count + 1);
        botThinkingRef.current = false;
        return nextMoves;
      });
    }, 700);

    return () => {
      clearTimeout(timeout);
      botThinkingRef.current = false;
    };
  }, [phase, isMyTurn, playerBoard, botMoveNumber]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Solo Match</h1>
            <p className="mt-1 text-xs text-slate-400">
              Bot difficulty:{" "}
              <span className="font-semibold text-emerald-300">
                {difficulty[0].toUpperCase() + difficulty.slice(1)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/lobby")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Lobby
          </button>
        </div>

        {phase === "in_progress" && (
          <TurnIndicator isMyTurn={isMyTurn} opponentName="Easy Bot" />
        )}

        {phase === "setup" && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Place Your Fleet
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Drag ships onto the board or click a cell to place the selected ship.
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
                    {getShipName(ship.size)} (1x{ship.size}){" "}
                    {isPlaced ? "Placed" : "Unplaced"}
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
                Selected: {getShipName(fleet.find((s) => s.id === selectedShipId)?.size ?? 1)}
              </span>
            </div>

            {placementError && (
              <p className="mt-3 rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {placementError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startBattle}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                Start Battle
              </button>
              <button
                type="button"
                onClick={() => setFleet(createFleetState(shipCount))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
              >
                Reset Placement
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 place-items-center">
          <BoardGrid
            cells={myDisplayBoard}
            interactive={phase === "setup"}
            onCellClick={handleMyBoardCellClick}
            onCellDrop={handleMyBoardCellDrop}
            onCellDragOver={handleMyBoardCellDragOver}
            onCellDragStart={handleMyBoardCellDragStart}
            onCellDragEnd={handleMyBoardCellDragEnd}
            previewMap={phase === "setup" ? previewMap : undefined}
            title="Your Fleet"
          />
          <BoardGrid
            cells={opponentDisplayBoard}
            interactive={phase === "in_progress" && isMyTurn}
            onCellClick={handleOpponentCellClick}
            title="Easy Bot Waters"
          />
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

        {phase === "finished" && endStats && (
          <GameEndModal
            isOpen
            isWinner={checkWinByMoves(botBoard, playerMoves)}
            opponentName="Easy Bot"
            stats={endStats}
          />
        )}
      </div>
    </main>
  );
}
