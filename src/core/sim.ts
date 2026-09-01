/** Headless unit movement along the shared A* path. */

import {
  createGrid,
  inBounds,
  sameTile,
  toggleTower,
  type Grid,
  type TileCoord,
} from "./grid";
import { findPath, isWalkable } from "./path";

export const UNIT_SPEED_TILES_PER_SEC = 2.75;
export const WANDER_RADIUS = 1;

const ARRIVE_EPS = 0.05;
const MAX_MOVE_ITERS = 24;
const WANDER_HOLD_SEC = 0.8;

const ORTHOGONAL: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export type Unit = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
};

export type SimState = {
  readonly grid: Grid;
  readonly units: readonly Unit[];
  readonly nextUnitId: number;
  readonly time: number;
};

export function unitTile(unit: Pick<Unit, "x" | "y">): TileCoord {
  return { x: Math.round(unit.x), y: Math.round(unit.y) };
}

export function createSim(grid: Grid = createGrid()): SimState {
  return {
    grid,
    units: [spawnUnit(1, grid.start)],
    nextUnitId: 2,
    time: 0,
  };
}

export function simToggleTower(state: SimState, x: number, y: number): SimState {
  const grid = toggleTower(state.grid, x, y);
  if (grid === state.grid) {
    return state;
  }
  return { ...state, grid };
}

export function tick(state: SimState, dt: number): SimState {
  if (!(dt > 0)) {
    return state;
  }
  let current = state;
  let remaining = Math.min(dt, 4);
  while (remaining > 1e-9) {
    const stepped = Math.min(0.05, remaining);
    current = tickOnce(current, stepped);
    remaining -= stepped;
  }
  return current;
}

function tickOnce(state: SimState, dt: number): SimState {
  const time = state.time + dt;
  const grid = state.grid;
  const units: Unit[] = [];
  let nextUnitId = state.nextUnitId;

  for (const unit of state.units) {
    const moved = stepUnit(unit, grid, dt, time);
    if (reachedBase(moved, grid)) {
      units.push(spawnUnit(nextUnitId, grid.start));
      nextUnitId += 1;
      continue;
    }
    units.push(moved);
  }

  return { grid, units, nextUnitId, time };
}

function spawnUnit(id: number, tile: TileCoord): Unit {
  return { id, x: tile.x, y: tile.y };
}

function reachedBase(unit: Unit, grid: Grid): boolean {
  return Math.hypot(unit.x - grid.base.x, unit.y - grid.base.y) <= ARRIVE_EPS;
}

function stepUnit(unit: Unit, grid: Grid, dt: number, time: number): Unit {
  let x = unit.x;
  let y = unit.y;
  let remaining = UNIT_SPEED_TILES_PER_SEC * dt;

  for (let iter = 0; iter < MAX_MOVE_ITERS && remaining > 1e-6; iter += 1) {
    const tile = unitTile({ x, y });
    if (!isWalkable(grid, tile.x, tile.y)) {
      const safe = nearestWalkable(grid, tile) ?? grid.start;
      x = safe.x;
      y = safe.y;
      continue;
    }

    const waypoint = nextWaypoint(grid, x, y, tile, time);
    if (!waypoint || !isWalkable(grid, waypoint.x, waypoint.y)) {
      break;
    }

    const dx = waypoint.x - x;
    const dy = waypoint.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ARRIVE_EPS) {
      x = waypoint.x;
      y = waypoint.y;
      continue;
    }

    const step = Math.min(remaining, dist);
    x += (dx / dist) * step;
    y += (dy / dist) * step;
    remaining -= step;
  }

  return { id: unit.id, x, y };
}

function nextWaypoint(
  grid: Grid,
  x: number,
  y: number,
  tile: TileCoord,
  time: number,
): TileCoord | null {
  const route = routeForTile(grid, tile, time);
  if (!route || route.length === 0) {
    return null;
  }

  const index = route.findIndex((node) => sameTile(node, tile));
  if (index >= 0) {
    const next = route[index + 1];
    if (next) {
      return next;
    }
    const end = route[index]!;
    if (Math.hypot(end.x - x, end.y - y) > ARRIVE_EPS) {
      return end;
    }
    return null;
  }

  for (const node of route) {
    if (Math.hypot(node.x - x, node.y - y) > ARRIVE_EPS) {
      return node;
    }
  }
  return null;
}

function routeForTile(grid: Grid, from: TileCoord, time: number): readonly TileCoord[] | null {
  const shared = findPath(grid);
  if (shared) {
    return joinSharedPath(grid, from, shared);
  }
  return blockedRoute(grid, from, time);
}

function joinSharedPath(
  grid: Grid,
  from: TileCoord,
  shared: readonly TileCoord[],
): readonly TileCoord[] | null {
  const index = shared.findIndex((tile) => sameTile(tile, from));
  if (index >= 0) {
    return shared.slice(index);
  }

  let best: TileCoord[] | null = null;
  for (const join of shared) {
    const leg = findPath(grid, from, join);
    if (!leg) {
      continue;
    }
    const joinAt = shared.findIndex((tile) => sameTile(tile, join));
    const combined = [...leg.slice(0, -1), ...shared.slice(joinAt)];
    if (!best || combined.length < best.length) {
      best = combined;
    }
  }
  return best;
}

function blockedRoute(grid: Grid, from: TileCoord, time: number): readonly TileCoord[] {
  const home = findPath(grid, from, grid.start);
  if (home && home.length > 1) {
    return home;
  }

  const neighborhood = startNeighborhood(grid);
  if (neighborhood.length === 0) {
    return [from];
  }
  const target = neighborhood[Math.floor(time / WANDER_HOLD_SEC) % neighborhood.length]!;
  if (sameTile(from, target)) {
    return [from];
  }
  return findPath(grid, from, target) ?? [from];
}

function startNeighborhood(grid: Grid): TileCoord[] {
  const tiles: TileCoord[] = [grid.start];
  for (const step of ORTHOGONAL) {
    const x = grid.start.x + step.x;
    const y = grid.start.y + step.y;
    if (
      isWalkable(grid, x, y) &&
      Math.abs(x - grid.start.x) + Math.abs(y - grid.start.y) <= WANDER_RADIUS
    ) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

function nearestWalkable(grid: Grid, from: TileCoord): TileCoord | null {
  if (isWalkable(grid, from.x, from.y)) {
    return from;
  }
  const queue: TileCoord[] = [from];
  const seen = new Set<string>([`${from.x},${from.y}`]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of ORTHOGONAL) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!inBounds(grid, x, y)) {
        continue;
      }
      const key = `${x},${y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (isWalkable(grid, x, y)) {
        return { x, y };
      }
      queue.push({ x, y });
    }
  }
  return null;
}
