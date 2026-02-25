import type {
  BoardState,
  CellState,
  Move,
  MoveResult,
  Ship,
} from "../types";
import type { MatchShip } from "../game/shipRules";
import { getShipType } from "../game/shipRules";

export interface AttackResult {
  result: MoveResult;
  sunkShip: Ship | null;
}

/**
 * Convert placement-UI fleet (MatchShip[]) to the DB BoardState format.
 */
export function convertFleetToBoard(fleet: MatchShip[]): BoardState {
  return {
    ships: fleet
      .filter((s) => s.cells.length > 0)
      .map((s) => ({
        type: s.type ?? getShipType(s.size),
        size: s.size,
        cells: s.cells,
        orientation: s.orientation ?? "horizontal",
        sunk: false,
      })),
  };
}

/**
 * Resolve an attack against a board.
 * Returns hit/miss/sunk and the sunk ship (if any).
 */
export function resolveAttack(
  board: BoardState,
  x: number,
  y: number,
  previousMoves: Pick<Move, "x" | "y">[]
): AttackResult {
  // Already attacked?
  const alreadyHit = previousMoves.some((m) => m.x === x && m.y === y);
  if (alreadyHit) {
    return { result: "miss", sunkShip: null };
  }

  // Check each ship
  for (const ship of board.ships) {
    const cellHit = ship.cells.some((c) => c.x === x && c.y === y);
    if (cellHit) {
      // Count existing hits on this ship (from previous moves)
      const existingHits = ship.cells.filter((c) =>
        previousMoves.some((m) => m.x === c.x && m.y === c.y)
      ).length;

      // +1 for the current hit
      const totalHits = existingHits + 1;

      if (totalHits >= ship.size) {
        return { result: "sunk", sunkShip: ship };
      }
      return { result: "hit", sunkShip: null };
    }
  }

  return { result: "miss", sunkShip: null };
}

/**
 * Check if all ships on a board are sunk.
 */
export function checkWin(board: BoardState): boolean {
  return board.ships.length > 0 && board.ships.every((ship) => ship.sunk);
}

/**
 * Check win condition by counting moves against the board.
 * More reliable than checking sunk flags since it uses actual move data.
 */
export function checkWinByMoves(
  board: BoardState,
  moves: Pick<Move, "x" | "y">[]
): boolean {
  if (board.ships.length === 0) return false;

  return board.ships.every((ship) => {
    const hitCount = ship.cells.filter((c) =>
      moves.some((m) => m.x === c.x && m.y === c.y)
    ).length;
    return hitCount >= ship.size;
  });
}

/**
 * Build the opponent's grid display from our attack moves.
 * Only shows hit/miss/sunk — never reveals ship positions.
 */
export function buildOpponentDisplay(
  myMoves: Move[],
  opponentBoard?: BoardState
): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () =>
    Array.from<CellState>({ length: 10 }).fill("empty")
  );

  for (const move of myMoves) {
    if (move.result === "sunk") {
      grid[move.y][move.x] = "sunk";
      // Mark all cells of the sunk ship
      if (opponentBoard && move.sunk_ship) {
        const ship = opponentBoard.ships.find(
          (s) => s.type === move.sunk_ship
        );
        if (ship) {
          for (const cell of ship.cells) {
            grid[cell.y][cell.x] = "sunk";
          }
        }
      }
    } else if (move.result === "hit") {
      // Only set to hit if not already sunk
      if (grid[move.y][move.x] !== "sunk") {
        grid[move.y][move.x] = "hit";
      }
    } else {
      grid[move.y][move.x] = "miss";
    }
  }

  return grid;
}

/**
 * Build my own board display — shows ship positions plus incoming hits.
 */
export function buildMyDisplay(
  boardState: BoardState,
  incomingMoves: Move[]
): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () =>
    Array.from<CellState>({ length: 10 }).fill("empty")
  );

  // Place ships
  for (const ship of boardState.ships) {
    for (const cell of ship.cells) {
      grid[cell.y][cell.x] = ship.sunk ? "sunk" : "ship";
    }
  }

  // Apply incoming hits
  for (const move of incomingMoves) {
    if (move.result === "hit") {
      grid[move.y][move.x] = "hit";
    } else if (move.result === "sunk") {
      // Find the ship at this cell and mark all its cells as sunk
      const ship = boardState.ships.find((s) =>
        s.cells.some((c) => c.x === move.x && c.y === move.y)
      );
      if (ship) {
        for (const cell of ship.cells) {
          grid[cell.y][cell.x] = "sunk";
        }
      } else {
        grid[move.y][move.x] = "sunk";
      }
    } else if (move.result === "miss") {
      grid[move.y][move.x] = "miss";
    }
  }

  return grid;
}

/**
 * Create an empty 10x10 board.
 */
export function emptyBoard(): CellState[][] {
  return Array.from({ length: 10 }, () =>
    Array.from<CellState>({ length: 10 }).fill("empty")
  );
}

/**
 * Build a board display from a fleet (placement phase).
 */
export function boardFromFleet(
  fleet: MatchShip[]
): CellState[][] {
  const board = emptyBoard();
  for (const ship of fleet) {
    for (const cell of ship.cells) {
      board[cell.y][cell.x] = "ship";
    }
  }
  return board;
}
