/** Five campaign battle maps shown on the world map. */

import { createGrid, type Grid, type TileCoord } from "./grid";

export const WORLD_MAP_COUNT = 5;

export type MapId = 1 | 2 | 3 | 4 | 5;

export type GameMapDef = {
  readonly id: MapId;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly start: TileCoord;
  readonly base: TileCoord;
};

export const WORLD_MAPS: readonly GameMapDef[] = [
  {
    id: 1,
    name: "평원",
    cols: 12,
    rows: 8,
    start: { x: 0, y: 3 },
    base: { x: 11, y: 3 },
  },
  {
    id: 2,
    name: "협곡",
    cols: 10,
    rows: 10,
    start: { x: 0, y: 0 },
    base: { x: 9, y: 9 },
  },
  {
    id: 3,
    name: "해안",
    cols: 14,
    rows: 6,
    start: { x: 0, y: 5 },
    base: { x: 13, y: 0 },
  },
  {
    id: 4,
    name: "고원",
    cols: 8,
    rows: 12,
    start: { x: 3, y: 11 },
    base: { x: 4, y: 0 },
  },
  {
    id: 5,
    name: "습지",
    cols: 12,
    rows: 10,
    start: { x: 0, y: 1 },
    base: { x: 11, y: 8 },
  },
];

export function isMapId(value: number): value is MapId {
  return Number.isInteger(value) && value >= 1 && value <= WORLD_MAP_COUNT;
}

export function getGameMap(id: number): GameMapDef {
  const def = WORLD_MAPS.find((map) => map.id === id);
  if (!def) {
    throw new Error(`Unknown map ${id}`);
  }
  return def;
}

export function createMapGrid(id: number): Grid {
  const map = getGameMap(id);
  return createGrid(map.cols, map.rows, map.start, map.base);
}
