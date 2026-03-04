import type { BoardState, Coordinate, Orientation, ShipType } from "../types";

export const MIN_SHIP_COUNT = 1;
export const MAX_SHIP_COUNT = 5;
export const BOARD_SIZE = 10;

const SHIP_TYPE_BY_SIZE: Record<number, ShipType> = {
  1: "destroyer",
  2: "submarine",
  3: "cruiser",
  4: "battleship",
  5: "carrier",
};

const SHIP_NAME_BY_SIZE: Record<number, string> = {
  1: "Destroyer",
  2: "Submarine",
  3: "Cruiser",
  4: "Battleship",
  5: "Carrier",
};

export function getShipType(size: number): ShipType {
  return SHIP_TYPE_BY_SIZE[size] ?? "destroyer";
}

export function getShipName(size: number): string {
  return SHIP_NAME_BY_SIZE[size] ?? `Ship-${size}`;
}

export interface MatchShip {
  id: string;
  type: ShipType;
  size: number;
  hits: number;
  sunk: boolean;
  cells: Coordinate[];
  orientation: Orientation;
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
    type: getShipType(size),
    size,
    hits: 0,
    sunk: false,
    cells: [],
    orientation: "horizontal" as Orientation,
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

export function hydrateFleetFromBoard(
  shipCount: number,
  board?: BoardState | null
): MatchShip[] {
  const baseFleet = createFleetState(shipCount);
  if (!board?.ships?.length) return baseFleet;

  const boardBySize = new Map(board.ships.map((ship) => [ship.size, ship]));

  return baseFleet.map((ship) => {
    const placed = boardBySize.get(ship.size);
    if (!placed) return ship;
    return {
      ...ship,
      cells: placed.cells,
      orientation: placed.orientation,
      sunk: placed.sunk,
    };
  });
}
