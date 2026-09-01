/** A* from Start to Base. Towers are blocked; empty / Start / Base are walkable. */

import { hasTower, inBounds, sameTile, type Grid, type TileCoord } from "./grid";

export type Path = readonly TileCoord[];

const ORTHOGONAL: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isWalkable(grid: Grid, x: number, y: number): boolean {
  return inBounds(grid, x, y) && !hasTower(grid, x, y);
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstruct(cameFrom: ReadonlyMap<string, TileCoord>, goal: TileCoord): Path {
  const path: TileCoord[] = [goal];
  let key = tileKey(goal.x, goal.y);
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key)!;
    path.push(prev);
    key = tileKey(prev.x, prev.y);
  }
  path.reverse();
  return path;
}

function lowestFKey(
  open: ReadonlySet<string>,
  fScore: ReadonlyMap<string, number>,
): string {
  let bestKey = "";
  let bestF = Infinity;
  for (const key of open) {
    const f = fScore.get(key) ?? Infinity;
    if (f < bestF) {
      bestF = f;
      bestKey = key;
    }
  }
  return bestKey;
}

/** Shortest orthogonal path from Start to Base, or null if none. */
export function findPath(grid: Grid): Path | null {
  if (!isWalkable(grid, grid.start.x, grid.start.y)) {
    return null;
  }
  if (!isWalkable(grid, grid.base.x, grid.base.y)) {
    return null;
  }
  if (sameTile(grid.start, grid.base)) {
    return [grid.start];
  }

  const startKey = tileKey(grid.start.x, grid.start.y);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([
    [startKey, manhattan(grid.start, grid.base)],
  ]);
  const cameFrom = new Map<string, TileCoord>();
  const coords = new Map<string, TileCoord>([[startKey, grid.start]]);
  const open = new Set<string>([startKey]);
  const closed = new Set<string>();

  while (open.size > 0) {
    const currentKey = lowestFKey(open, fScore);
    const current = coords.get(currentKey)!;
    if (sameTile(current, grid.base)) {
      return reconstruct(cameFrom, current);
    }

    open.delete(currentKey);
    closed.add(currentKey);

    for (const step of ORTHOGONAL) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!isWalkable(grid, x, y)) {
        continue;
      }
      const nextKey = tileKey(x, y);
      if (closed.has(nextKey)) {
        continue;
      }
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeG >= (gScore.get(nextKey) ?? Infinity)) {
        continue;
      }
      const next = { x, y };
      cameFrom.set(nextKey, current);
      coords.set(nextKey, next);
      gScore.set(nextKey, tentativeG);
      fScore.set(nextKey, tentativeG + manhattan(next, grid.base));
      open.add(nextKey);
    }
  }

  return null;
}
