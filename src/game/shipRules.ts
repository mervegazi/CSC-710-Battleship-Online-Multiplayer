import type { Coordinate, Orientation } from "../types";

export const MIN_SHIP_COUNT = 1;
export const MAX_SHIP_COUNT = 5;
export const BOARD_SIZE = 10;

export interface MatchShip {
  id: string;
  size: number;
  hits: number;
  sunk: boolean;
  cells: Coordinate[];
}

/**
 * Rule: if shipCount is N, fleet sizes are [1, 2, ..., N].
 */
export function getFleetSizes(shipCount: number): number[] {
  if (!Number.isInteger(shipCount)) {
    throw new Error("Ship count must be an integer.");
  }
  if (shipCount < MIN_SHIP_COUNT || shipCount > MAX_SHIP_COUNT) {
    throw new Error(
      `Ship count must be between ${MIN_SHIP_COUNT} and ${MAX_SHIP_COUNT}.`
    );
  }

  return Array.from({ length: shipCount }, (_, index) => index + 1);
}

export function createFleetState(shipCount: number): MatchShip[] {
  return getFleetSizes(shipCount).map((size, index) => ({
    id: `ship-${index + 1}`,
    size,
    hits: 0,
    sunk: false,
    cells: []
  }));
}

export function getShipCells(
  startRow: number,
  startCol: number,
  size: number,
  orientation: Orientation
): Coordinate[] {
  return Array.from({ length: size }, (_, offset) => ({
    x: orientation === "horizontal" ? startCol + offset : startCol,
    y: orientation === "vertical" ? startRow + offset : startRow
  }));
}

export function areCellsInBounds(cells: Coordinate[]): boolean {
  return cells.every(
    (cell) =>
      cell.x >= 0 &&
      cell.x < BOARD_SIZE &&
      cell.y >= 0 &&
      cell.y < BOARD_SIZE
  );
}

export function hasOverlap(
  ships: MatchShip[],
  nextCells: Coordinate[],
  excludeShipId?: string
): boolean {
  const occupied = new Set(
    ships
      .filter((ship) => ship.id !== excludeShipId)
      .flatMap((ship) => ship.cells.map((cell) => `${cell.x},${cell.y}`))
  );

  return nextCells.some((cell) => occupied.has(`${cell.x},${cell.y}`));
}
