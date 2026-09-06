/** Five campaign battle maps shown on the world map. */

import { createGrid, withTowers, type Grid, type ObstacleDef, type TileCoord, type Tower } from "./grid";

export const WORLD_MAP_COUNT = 5;

export type MapId = 1 | 2 | 3 | 4 | 5;

export type GameMapDef = {
  readonly id: MapId;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly start: TileCoord;
  readonly base: TileCoord;
  readonly obstacles: readonly ObstacleDef[];
};

function rock(x: number, y: number): ObstacleDef {
  return { kind: "rock", x, y };
}

function tree(x: number, y: number): ObstacleDef {
  return { kind: "tree", x, y };
}

export const WORLD_MAPS: readonly GameMapDef[] = [
  {
    id: 1,
    name: "평원",
    cols: 12,
    rows: 8,
    start: { x: 0, y: 3 },
    base: { x: 11, y: 3 },
    obstacles: [
      tree(2, 1),
      rock(5, 3),
      tree(4, 5),
      rock(3, 6),
      tree(7, 2),
      rock(8, 7),
      tree(9, 6),
      rock(10, 1),
    ],
  },
  {
    id: 2,
    name: "협곡",
    cols: 10,
    rows: 10,
    start: { x: 0, y: 0 },
    base: { x: 9, y: 9 },
    obstacles: [
      rock(1, 0),
      rock(1, 1),
      rock(2, 1),
      rock(4, 3),
      rock(5, 5),
      rock(7, 6),
      rock(8, 8),
      tree(0, 3),
      tree(3, 6),
      tree(6, 2),
      tree(6, 8),
      tree(9, 4),
    ],
  },
  {
    id: 3,
    name: "해안",
    cols: 14,
    rows: 6,
    start: { x: 0, y: 5 },
    base: { x: 13, y: 0 },
    obstacles: [
      rock(1, 5),
      rock(4, 5),
      rock(8, 4),
      rock(11, 5),
      tree(2, 2),
      tree(5, 0),
      tree(7, 1),
      tree(10, 2),
      tree(12, 3),
    ],
  },
  {
    id: 4,
    name: "고원",
    cols: 8,
    rows: 12,
    start: { x: 3, y: 11 },
    base: { x: 4, y: 0 },
    obstacles: [
      rock(3, 9),
      rock(4, 7),
      rock(1, 6),
      rock(6, 5),
      rock(2, 3),
      tree(0, 10),
      tree(6, 10),
      tree(1, 1),
      tree(6, 1),
      tree(5, 8),
    ],
  },
  {
    id: 5,
    name: "습지",
    cols: 12,
    rows: 10,
    start: { x: 0, y: 1 },
    base: { x: 11, y: 8 },
    obstacles: [
      tree(1, 1),
      tree(3, 3),
      tree(5, 1),
      tree(6, 6),
      tree(8, 8),
      tree(9, 4),
      rock(2, 7),
      rock(4, 9),
      rock(7, 2),
      rock(10, 6),
    ],
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
  return createGrid(map.cols, map.rows, map.start, map.base, map.obstacles);
}

export function createBattleGrid(id: number, towers: readonly Tower[] = []): Grid {
  return withTowers(createMapGrid(id), towers);
}
