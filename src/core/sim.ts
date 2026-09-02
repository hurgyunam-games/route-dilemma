/** Headless unit movement along the shared A* path. */

import {
  createGrid,
  damageTower,
  getTower,
  inBounds,
  sameTile,
  toggleTower,
  type Grid,
  type TileCoord,
  type Tower,
} from "./grid";
import { findPath, isWalkable } from "./path";

export const UNIT_SPEED_TILES_PER_SEC = 2.75;
export const UNIT_ATTACK_DPS = 4;
export const PHASE_DURATION_SEC = 15;
export const ALLY_GOLD_REWARD = 10;
export const TIME_SCALES = [0, 1, 2, 3] as const;

export type Phase = "enemy" | "ally";
export type UnitKind = Phase;
export type TimeScale = (typeof TIME_SCALES)[number];

const ARRIVE_EPS = 0.05;
const MAX_MOVE_ITERS = 24;

const ORTHOGONAL: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export type Unit = {
  readonly id: number;
  readonly kind: UnitKind;
  readonly x: number;
  readonly y: number;
  /** Tower being hit; null while walking or waiting. */
  readonly attackTile: TileCoord | null;
};

export type SimState = {
  readonly grid: Grid;
  readonly units: readonly Unit[];
  readonly nextUnitId: number;
  readonly time: number;
  readonly phase: Phase;
  readonly phaseTimeLeft: number;
  readonly timeScale: TimeScale;
  readonly gold: number;
};

export type HudSnapshot = {
  readonly phase: Phase;
  readonly phaseTimeLeft: number;
  readonly hasPath: boolean;
  readonly timeScale: TimeScale;
  readonly gold: number;
};

type StepResult = {
  readonly unit: Unit;
  readonly grid: Grid;
};

export function unitTile(unit: Pick<Unit, "x" | "y">): TileCoord {
  return { x: Math.round(unit.x), y: Math.round(unit.y) };
}

export function createSim(grid: Grid = createGrid()): SimState {
  return {
    grid,
    units: [spawnUnit(1, grid.start, "enemy")],
    nextUnitId: 2,
    time: 0,
    phase: "enemy",
    phaseTimeLeft: PHASE_DURATION_SEC,
    timeScale: 1,
    gold: 0,
  };
}

export function hudSnapshot(state: SimState): HudSnapshot {
  return {
    phase: state.phase,
    phaseTimeLeft: state.phaseTimeLeft,
    hasPath: findPath(state.grid) !== null,
    timeScale: state.timeScale,
    gold: state.gold,
  };
}

export function setTimeScale(state: SimState, timeScale: TimeScale): SimState {
  if (state.timeScale === timeScale) {
    return state;
  }
  return { ...state, timeScale };
}

export function simToggleTower(state: SimState, x: number, y: number): SimState {
  const grid = toggleTower(state.grid, x, y);
  if (grid === state.grid) {
    return state;
  }
  return { ...state, grid };
}

export function tick(state: SimState, dt: number): SimState {
  const scaled = dt * state.timeScale;
  if (!(scaled > 0)) {
    return state;
  }
  let current = state;
  let remaining = Math.min(scaled, 4);
  while (remaining > 1e-9) {
    const stepped = Math.min(0.05, remaining);
    current = tickOnce(current, stepped);
    remaining -= stepped;
  }
  return current;
}

function tickOnce(state: SimState, dt: number): SimState {
  const time = state.time + dt;
  const clock = tickPhaseClock(state.phase, state.phaseTimeLeft, dt);
  let grid = state.grid;
  let gold = state.gold;
  let nextUnitId = state.nextUnitId;
  const units: Unit[] = [];

  for (const unit of unitsForPhase(state.units, clock.phase)) {
    const moved = stepUnit(unit, grid, dt);
    grid = moved.grid;
    if (reachedBase(moved.unit, grid)) {
      if (moved.unit.kind === "ally") {
        gold += ALLY_GOLD_REWARD;
      }
      continue;
    }
    units.push(moved.unit);
  }

  if (!units.some((unit) => unit.kind === clock.phase)) {
    units.push(spawnUnit(nextUnitId, grid.start, clock.phase));
    nextUnitId += 1;
  }

  return {
    grid,
    units,
    nextUnitId,
    time,
    phase: clock.phase,
    phaseTimeLeft: clock.phaseTimeLeft,
    timeScale: state.timeScale,
    gold,
  };
}

function tickPhaseClock(
  phase: Phase,
  timeLeft: number,
  dt: number,
): { phase: Phase; phaseTimeLeft: number } {
  let nextPhase = phase;
  let remaining = timeLeft - dt;
  while (remaining <= 0) {
    nextPhase = nextPhase === "enemy" ? "ally" : "enemy";
    remaining += PHASE_DURATION_SEC;
  }
  return { phase: nextPhase, phaseTimeLeft: remaining };
}

function unitsForPhase(units: readonly Unit[], phase: Phase): Unit[] {
  return units.filter((unit) => unit.kind === phase);
}

function spawnUnit(id: number, tile: TileCoord, kind: UnitKind): Unit {
  return { id, kind, x: tile.x, y: tile.y, attackTile: null };
}

function reachedBase(unit: Unit, grid: Grid): boolean {
  return Math.hypot(unit.x - grid.base.x, unit.y - grid.base.y) <= ARRIVE_EPS;
}

function stepUnit(unit: Unit, grid: Grid, dt: number): StepResult {
  let x = unit.x;
  let y = unit.y;

  const stuck = unitTile({ x, y });
  if (!isWalkable(grid, stuck.x, stuck.y)) {
    const safe = nearestWalkable(grid, stuck) ?? grid.start;
    x = safe.x;
    y = safe.y;
  }

  const tile = unitTile({ x, y });
  if (unit.kind !== "ally") {
    const target = attackTarget(grid, tile);
    if (target && isOrthAdjacent(tile, target)) {
      return {
        unit: {
          id: unit.id,
          kind: unit.kind,
          x,
          y,
          attackTile: { x: target.x, y: target.y },
        },
        grid: damageTower(grid, target.x, target.y, UNIT_ATTACK_DPS * dt),
      };
    }
  }

  let remaining = UNIT_SPEED_TILES_PER_SEC * dt;
  for (let iter = 0; iter < MAX_MOVE_ITERS && remaining > 1e-6; iter += 1) {
    const here = unitTile({ x, y });
    if (!isWalkable(grid, here.x, here.y)) {
      const safe = nearestWalkable(grid, here) ?? grid.start;
      x = safe.x;
      y = safe.y;
      continue;
    }

    const waypoint = nextWaypoint(grid, x, y, here, unit.kind);
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

  return { unit: { id: unit.id, kind: unit.kind, x, y, attackTile: null }, grid };
}

function nextWaypoint(
  grid: Grid,
  x: number,
  y: number,
  tile: TileCoord,
  kind: UnitKind,
): TileCoord | null {
  const route = routeForTile(grid, tile, kind);
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

function routeForTile(
  grid: Grid,
  from: TileCoord,
  kind: UnitKind,
): readonly TileCoord[] | null {
  const shared = findPath(grid);
  if (shared) {
    const joined = joinSharedPath(grid, from, shared);
    if (joined) {
      return joined;
    }
  }

  const local = findPath(grid, from, grid.base);
  if (local) {
    return local;
  }

  if (kind === "ally") {
    return null;
  }
  return approachTowerRoute(grid, from);
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

function attackTarget(grid: Grid, from: TileCoord): Tower | null {
  if (findPath(grid, from, grid.base)) {
    return null;
  }
  return nearestChokepointTower(grid, from);
}

function approachTowerRoute(grid: Grid, from: TileCoord): readonly TileCoord[] | null {
  const target = nearestChokepointTower(grid, from);
  if (!target) {
    return null;
  }
  const stand = standingTile(grid, from, target);
  if (!stand) {
    return null;
  }
  if (sameTile(from, stand)) {
    return [from];
  }
  return findPath(grid, from, stand);
}

function nearestChokepointTower(grid: Grid, from: TileCoord): Tower | null {
  const reachable = walkableRegion(grid, from);
  const candidates: Tower[] = [];
  const seen = new Set<string>();
  for (const tile of reachable) {
    for (const step of ORTHOGONAL) {
      const x = tile.x + step.x;
      const y = tile.y + step.y;
      const tower = getTower(grid, x, y);
      if (!tower) {
        continue;
      }
      const key = `${x},${y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      candidates.push(tower);
    }
  }
  const pool = candidates.length > 0 ? candidates : [...grid.towers];
  if (pool.length === 0) {
    return null;
  }
  return pool.reduce((best, tower) =>
    betterTarget(tower, best, from, grid.base) ? tower : best,
  );
}

function betterTarget(
  candidate: Tower,
  current: Tower,
  from: TileCoord,
  base: TileCoord,
): boolean {
  const candidateDist = manhattan(candidate, from);
  const currentDist = manhattan(current, from);
  if (candidateDist !== currentDist) {
    return candidateDist < currentDist;
  }
  const candidateToBase = manhattan(candidate, base);
  const currentToBase = manhattan(current, base);
  if (candidateToBase !== currentToBase) {
    return candidateToBase < currentToBase;
  }
  if (candidate.y !== current.y) {
    return candidate.y < current.y;
  }
  return candidate.x < current.x;
}

function standingTile(grid: Grid, from: TileCoord, tower: Tower): TileCoord | null {
  let best: TileCoord | null = null;
  let bestLength = Infinity;
  for (const step of ORTHOGONAL) {
    const tile = { x: tower.x + step.x, y: tower.y + step.y };
    if (!isWalkable(grid, tile.x, tile.y)) {
      continue;
    }
    const path = findPath(grid, from, tile);
    if (!path) {
      continue;
    }
    if (path.length < bestLength) {
      bestLength = path.length;
      best = tile;
    }
  }
  return best;
}

function walkableRegion(grid: Grid, from: TileCoord): TileCoord[] {
  const start = isWalkable(grid, from.x, from.y) ? from : nearestWalkable(grid, from);
  if (!start) {
    return [];
  }
  const tiles: TileCoord[] = [];
  const queue: TileCoord[] = [start];
  const seen = new Set<string>([`${start.x},${start.y}`]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    tiles.push(current);
    for (const step of ORTHOGONAL) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!isWalkable(grid, x, y)) {
        continue;
      }
      const key = `${x},${y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return tiles;
}

function isOrthAdjacent(a: TileCoord, b: TileCoord): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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
