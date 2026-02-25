import type { Coordinate } from "../types";

export const MIN_SHIP_COUNT = 1;
export const MAX_SHIP_COUNT = 5;

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
