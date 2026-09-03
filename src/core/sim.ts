/** Headless unit movement along the shared A* path. */

import {
  advanceTowerBuilds,
  createGrid,
  damageTower,
  getTower,
  hasTower,
  inBounds,
  placeTower,
  sameTile,
  toggleTower,
  upgradeTower,
  type Grid,
  type TileCoord,
  type Tower,
} from "./grid";
import { findPath, isWalkable } from "./path";
import {
  BUILD_DURATION_SEC,
  isTowerComplete,
  TOWER_MAX_LEVEL,
  towerAttack,
  towerBuildCost,
  towerDps,
  towerRange,
  towerSlowFactor,
  towerSlowSec,
  towerSplashRadius,
  towerUpgradeCost,
  type TowerTypeId,
} from "./towers";
import {
  getStageWave,
  phaseDuration,
  type EnemyTypeId,
  type StageWave,
  type WaveBurst,
} from "./waves";

export { ENEMY_TYPE_IDS, getStageWave, STAGE_COUNT } from "./waves";
export type { EnemyTypeId, StageWave, WaveBurst } from "./waves";
export {
  BUILD_DURATION_SEC,
  canUpgrade,
  DEFAULT_TOWER_TYPE,
  isTowerComplete,
  TOWER_ATTACK_LABELS,
  TOWER_CATALOG,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  TOWER_TYPE_IDS,
  towerAttack,
  towerBuildCost,
  towerDps,
  towerMaxHp,
  towerRange,
  towerSlowFactor,
  towerSlowSec,
  towerSplashRadius,
  towerUpgradeCost,
  towerWorkDuration,
  UPGRADE_DURATION_SEC,
} from "./towers";
export type { TowerAttackId, TowerDef, TowerLevelStats, TowerTypeId } from "./towers";

export const UNIT_SPEED_TILES_PER_SEC = 2.75;
export const UNIT_ATTACK_DPS = 4;
export const UNIT_MAX_HP = 16;
export const TOWER_RANGE_TILES = towerRange({ typeId: "archer", level: 1 });
export const TOWER_ATTACK_DPS = towerDps({ typeId: "archer", level: 1 });
export const TOWER_FIRE_INTERVAL_SEC = 0.4;
export const PROJECTILE_SPEED_TILES_PER_SEC = 10;
export const CATCH_RANGE_TILES = 1;
export const ALLY_GOLD_REWARD = 10;
export const START_GOLD = 100;
export const BASE_MAX_HP = 20;
export const ENEMY_BASE_DAMAGE = 1;
export const TIME_SCALES = [0, 1, 2, 3] as const;
export const PHASE_DURATION_SEC = getStageWave(1).enemyPhaseSec;
export const SPAWN_INTERVAL_SEC = getStageWave(1).bursts[0]!.interval;
export const WAVE_SIZE = getStageWave(1).bursts[0]!.count;

export type Phase = "enemy" | "ally";
export type UnitKind = Phase;
export type TimeScale = (typeof TIME_SCALES)[number];

export type CommandResult =
  | { readonly ok: true; readonly state: SimState }
  | { readonly ok: false; readonly reason: string };

const ARRIVE_EPS = 0.05;
const PROJECTILE_HIT_EPS = 0.22;
const MAX_MOVE_ITERS = 24;
const SPAWN_CLEARANCE_TILES = 0.9;

const ORTHOGONAL: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export type Unit = {
  readonly id: number;
  readonly kind: UnitKind;
  readonly enemyType: EnemyTypeId | null;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly slowLeft: number;
  readonly slowFactor: number;
  /** Tower being hit; null while walking or waiting. */
  readonly attackTile: TileCoord | null;
};

export type TowerShot = {
  readonly id: number;
  readonly typeId: TowerTypeId;
  readonly x: number;
  readonly y: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly targetId: number;
  readonly damage: number;
};

export type SimState = {
  readonly grid: Grid;
  readonly units: readonly Unit[];
  readonly towerShots: readonly TowerShot[];
  readonly fireCooldown: Readonly<Record<string, number>>;
  readonly nextShotId: number;
  readonly nextUnitId: number;
  readonly time: number;
  readonly phase: Phase;
  readonly phaseTimeLeft: number;
  readonly timeScale: TimeScale;
  readonly gold: number;
  readonly baseHp: number;
  readonly stageId: number;
  readonly burstIndex: number;
  readonly spawnedInBurst: number;
  readonly spawnCooldown: number;
};

export type HudSnapshot = {
  readonly phase: Phase;
  readonly phaseTimeLeft: number;
  readonly hasPath: boolean;
  readonly timeScale: TimeScale;
  readonly gold: number;
  readonly baseHp: number;
  readonly leftoverAllies: number;
  readonly stageId: number;
};

type StepResult = {
  readonly unit: Unit;
  readonly grid: Grid;
};

export function unitTile(unit: Pick<Unit, "x" | "y">): TileCoord {
  return { x: Math.round(unit.x), y: Math.round(unit.y) };
}

export function createSim(grid: Grid = createGrid(), stageId = 1): SimState {
  const stage = getStageWave(stageId);
  const first = stage.bursts[0]!;
  return {
    grid,
    units: [spawnFromBurst(1, grid.start, "enemy", first, 0)],
    towerShots: [],
    fireCooldown: {},
    nextShotId: 1,
    nextUnitId: 2,
    time: 0,
    phase: "enemy",
    phaseTimeLeft: stage.enemyPhaseSec,
    timeScale: 1,
    gold: START_GOLD,
    baseHp: BASE_MAX_HP,
    stageId: stage.id,
    burstIndex: 0,
    spawnedInBurst: 1,
    spawnCooldown: first.interval,
  };
}

export function hudSnapshot(state: SimState): HudSnapshot {
  return {
    phase: state.phase,
    phaseTimeLeft: state.phaseTimeLeft,
    hasPath: findPath(state.grid) !== null,
    timeScale: state.timeScale,
    gold: state.gold,
    baseHp: state.baseHp,
    leftoverAllies:
      state.phase === "enemy"
        ? state.units.filter((unit) => unit.kind === "ally").length
        : 0,
    stageId: state.stageId,
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

function goldShort(need: number, have: number): string {
  return `골드가 부족합니다 (필요 ${need}, 보유 ${have})`;
}

export function simBeginBuild(
  state: SimState,
  x: number,
  y: number,
  typeId: TowerTypeId,
): CommandResult {
  if (!inBounds(state.grid, x, y)) {
    return { ok: false, reason: "여기에 지을 수 없습니다" };
  }
  if (
    sameTile(state.grid.start, { x, y }) ||
    sameTile(state.grid.base, { x, y })
  ) {
    return { ok: false, reason: "여기에 지을 수 없습니다" };
  }
  if (hasTower(state.grid, x, y)) {
    return { ok: false, reason: "이미 타워가 있습니다" };
  }
  const cost = towerBuildCost(typeId);
  if (state.gold < cost) {
    return { ok: false, reason: goldShort(cost, state.gold) };
  }
  const grid = placeTower(state.grid, x, y, typeId, BUILD_DURATION_SEC);
  if (grid === state.grid) {
    return { ok: false, reason: "여기에 지을 수 없습니다" };
  }
  return {
    ok: true,
    state: { ...state, grid, gold: state.gold - cost },
  };
}

export function simUpgradeTower(
  state: SimState,
  x: number,
  y: number,
): CommandResult {
  const tower = getTower(state.grid, x, y);
  if (!tower) {
    return { ok: false, reason: "타워가 없습니다" };
  }
  if (!isTowerComplete(tower)) {
    return { ok: false, reason: "아직 건설 중입니다" };
  }
  if (tower.level >= TOWER_MAX_LEVEL) {
    return { ok: false, reason: "최대 레벨입니다" };
  }
  const cost = towerUpgradeCost(tower);
  if (state.gold < cost) {
    return { ok: false, reason: goldShort(cost, state.gold) };
  }
  const grid = upgradeTower(state.grid, x, y);
  if (grid === state.grid) {
    return { ok: false, reason: "업그레이드할 수 없습니다" };
  }
  return {
    ok: true,
    state: { ...state, grid, gold: state.gold - cost },
  };
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
  const stage = getStageWave(state.stageId);
  const clock = tickPhaseClock(state.phase, state.phaseTimeLeft, dt, stage);
  let grid = advanceTowerBuilds(state.grid, dt);
  let gold = state.gold;
  let baseHp = state.baseHp;
  let nextUnitId = state.nextUnitId;
  let units: Unit[] = [];
  const phaseChanged = clock.phase !== state.phase;
  let burstIndex = phaseChanged ? 0 : state.burstIndex;
  let spawnedInBurst = phaseChanged ? 0 : state.spawnedInBurst;
  let spawnCooldown = phaseChanged ? 0 : state.spawnCooldown - dt;

  for (const unit of retainUnits(state.units, state.phase, clock.phase)) {
    const moved = stepUnit(unit, grid, dt);
    grid = moved.grid;
    if (reachedBase(moved.unit, grid)) {
      if (moved.unit.kind === "ally") {
        gold += ALLY_GOLD_REWARD;
      } else {
        baseHp = Math.max(0, baseHp - ENEMY_BASE_DAMAGE);
      }
      continue;
    }
    units.push(moved.unit);
  }

  units = enemiesCatchAllies(units);

  const fired = fireTowers(
    grid,
    units,
    state.towerShots,
    state.fireCooldown,
    dt,
    state.nextShotId,
  );
  units = fired.units;

  const spawned = trySpawnWave(
    units,
    nextUnitId,
    grid.start,
    clock.phase,
    stage,
    burstIndex,
    spawnedInBurst,
    spawnCooldown,
  );
  units = spawned.units;
  nextUnitId = spawned.nextUnitId;
  burstIndex = spawned.burstIndex;
  spawnedInBurst = spawned.spawnedInBurst;
  spawnCooldown = spawned.spawnCooldown;

  return {
    grid,
    units,
    towerShots: fired.shots,
    fireCooldown: fired.fireCooldown,
    nextShotId: fired.nextShotId,
    nextUnitId,
    time,
    phase: clock.phase,
    phaseTimeLeft: clock.phaseTimeLeft,
    timeScale: state.timeScale,
    gold,
    baseHp,
    stageId: state.stageId,
    burstIndex,
    spawnedInBurst,
    spawnCooldown,
  };
}

function tickPhaseClock(
  phase: Phase,
  timeLeft: number,
  dt: number,
  stage: StageWave,
): { phase: Phase; phaseTimeLeft: number } {
  let nextPhase = phase;
  let remaining = timeLeft - dt;
  while (remaining <= 0) {
    nextPhase = nextPhase === "enemy" ? "ally" : "enemy";
    remaining += phaseDuration(stage, nextPhase);
  }
  return { phase: nextPhase, phaseTimeLeft: remaining };
}

function retainUnits(
  units: readonly Unit[],
  prevPhase: Phase,
  nextPhase: Phase,
): Unit[] {
  if (prevPhase === nextPhase) {
    return [...units];
  }
  if (nextPhase === "enemy") {
    return units.filter((unit) => unit.kind === "ally");
  }
  return [];
}

function enemiesCatchAllies(units: readonly Unit[]): Unit[] {
  const enemies = units.filter((unit) => unit.kind === "enemy");
  if (enemies.length === 0) {
    return [...units];
  }

  const caught = new Set<number>();
  const attacking = new Map<number, TileCoord>();
  for (const ally of units) {
    if (ally.kind !== "ally") {
      continue;
    }
    for (const enemy of enemies) {
      if (Math.hypot(enemy.x - ally.x, enemy.y - ally.y) > CATCH_RANGE_TILES) {
        continue;
      }
      caught.add(ally.id);
      if (!attacking.has(enemy.id)) {
        attacking.set(enemy.id, unitTile(ally));
      }
      break;
    }
  }

  if (caught.size === 0) {
    return [...units];
  }

  return units
    .filter((unit) => !caught.has(unit.id))
    .map((unit) => {
      const tile = attacking.get(unit.id);
      return tile ? { ...unit, attackTile: tile } : unit;
    });
}

function trySpawnWave(
  units: Unit[],
  nextUnitId: number,
  start: TileCoord,
  kind: UnitKind,
  stage: StageWave,
  burstIndex: number,
  spawnedInBurst: number,
  spawnCooldown: number,
): {
  units: Unit[];
  nextUnitId: number;
  burstIndex: number;
  spawnedInBurst: number;
  spawnCooldown: number;
} {
  if (spawnCooldown > 0) {
    return { units, nextUnitId, burstIndex, spawnedInBurst, spawnCooldown };
  }
  if (kindOccupiesStart(units, start, kind)) {
    return { units, nextUnitId, burstIndex, spawnedInBurst, spawnCooldown };
  }

  if (kind === "ally") {
    if (spawnedInBurst >= stage.allyCount) {
      return { units, nextUnitId, burstIndex, spawnedInBurst, spawnCooldown };
    }
    return {
      units: enemiesCatchAllies([
        ...units,
        spawnUnit(nextUnitId, start, "ally", null, UNIT_MAX_HP),
      ]),
      nextUnitId: nextUnitId + 1,
      burstIndex,
      spawnedInBurst: spawnedInBurst + 1,
      spawnCooldown: stage.allyInterval,
    };
  }

  const burst = stage.bursts[burstIndex];
  if (!burst) {
    return { units, nextUnitId, burstIndex, spawnedInBurst, spawnCooldown };
  }
  if (spawnedInBurst >= burst.count) {
    const nextBurst = burstIndex + 1;
    return {
      units,
      nextUnitId,
      burstIndex: nextBurst,
      spawnedInBurst: 0,
      spawnCooldown: burst.restAfter,
    };
  }

  return {
    units: enemiesCatchAllies([
      ...units,
      spawnFromBurst(nextUnitId, start, "enemy", burst, spawnedInBurst),
    ]),
    nextUnitId: nextUnitId + 1,
    burstIndex,
    spawnedInBurst: spawnedInBurst + 1,
    spawnCooldown: burst.interval,
  };
}

function kindOccupiesStart(
  units: readonly Unit[],
  start: TileCoord,
  kind: UnitKind,
): boolean {
  return units.some(
    (unit) =>
      unit.kind === kind &&
      Math.hypot(unit.x - start.x, unit.y - start.y) < SPAWN_CLEARANCE_TILES,
  );
}

function spawnFromBurst(
  id: number,
  tile: TileCoord,
  kind: UnitKind,
  burst: WaveBurst,
  index: number,
): Unit {
  const enemyType = burst.types[index % burst.types.length] ?? burst.types[0] ?? "slime";
  return spawnUnit(id, tile, kind, enemyType, burst.hp);
}

function spawnUnit(
  id: number,
  tile: TileCoord,
  kind: UnitKind,
  enemyType: EnemyTypeId | null = null,
  hp: number = UNIT_MAX_HP,
): Unit {
  return {
    id,
    kind,
    enemyType: kind === "enemy" ? (enemyType ?? "beast") : null,
    x: tile.x,
    y: tile.y,
    hp,
    slowLeft: 0,
    slowFactor: 1,
    attackTile: null,
  };
}

function reachedBase(unit: Unit, grid: Grid): boolean {
  return Math.hypot(unit.x - grid.base.x, unit.y - grid.base.y) <= ARRIVE_EPS;
}

function stepUnit(unit: Unit, grid: Grid, dt: number): StepResult {
  let x = unit.x;
  let y = unit.y;
  const slowLeft = Math.max(0, unit.slowLeft - dt);
  const slowFactor = slowLeft > 0 ? unit.slowFactor : 1;

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
          ...unit,
          x,
          y,
          slowLeft,
          slowFactor,
          attackTile: { x: target.x, y: target.y },
        },
        grid: damageTower(grid, target.x, target.y, UNIT_ATTACK_DPS * dt),
      };
    }
  }

  let remaining = UNIT_SPEED_TILES_PER_SEC * slowFactor * dt;
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

  return { unit: { ...unit, x, y, slowLeft, slowFactor, attackTile: null }, grid };
}

function fireTowers(
  grid: Grid,
  units: readonly Unit[],
  shots: readonly TowerShot[],
  fireCooldown: Readonly<Record<string, number>>,
  dt: number,
  nextShotId: number,
): {
  units: Unit[];
  shots: TowerShot[];
  fireCooldown: Record<string, number>;
  nextShotId: number;
} {
  const hpById = new Map<number, number>();
  const slowLeftById = new Map<number, number>();
  const slowFactorById = new Map<number, number>();
  for (const unit of units) {
    hpById.set(unit.id, unit.hp);
    slowLeftById.set(unit.id, unit.slowLeft);
    slowFactorById.set(unit.id, unit.slowFactor);
  }

  const cooldown: Record<string, number> = { ...fireCooldown };
  const live: TowerShot[] = [];
  let shotId = nextShotId;

  for (const shot of shots) {
    const target = units.find((unit) => unit.id === shot.targetId && unit.kind === "enemy");
    const targetHp = target ? (hpById.get(target.id) ?? target.hp) : 0;
    const alive = Boolean(target && targetHp > 0);
    const aimX = alive ? target!.x : shot.toX;
    const aimY = alive ? target!.y : shot.toY;
    const dx = aimX - shot.x;
    const dy = aimY - shot.y;
    const dist = Math.hypot(dx, dy);
    const step = PROJECTILE_SPEED_TILES_PER_SEC * dt;
    if (alive && dist <= Math.max(PROJECTILE_HIT_EPS, step)) {
      applyProjectileHit(shot, target!, units, hpById, slowLeftById, slowFactorById);
      continue;
    }
    if (!alive && dist <= step) {
      continue;
    }
    if (!(dist > 1e-9)) {
      continue;
    }
    live.push({
      ...shot,
      x: shot.x + (dx / dist) * Math.min(step, dist),
      y: shot.y + (dy / dist) * Math.min(step, dist),
      toX: aimX,
      toY: aimY,
    });
  }

  for (const tower of grid.towers) {
    const key = `${tower.x},${tower.y}`;
    const left = Math.max(0, (cooldown[key] ?? 0) - dt);
    cooldown[key] = left;
    if (!isTowerComplete(tower) || left > 0) {
      continue;
    }
    const target = nearestEnemyInRange(tower, units, hpById);
    if (!target) {
      continue;
    }
    live.push({
      id: shotId,
      typeId: tower.typeId,
      x: tower.x,
      y: tower.y,
      fromX: tower.x,
      fromY: tower.y,
      toX: target.x,
      toY: target.y,
      targetId: target.id,
      damage: towerDps(tower) * TOWER_FIRE_INTERVAL_SEC,
    });
    shotId += 1;
    cooldown[key] = TOWER_FIRE_INTERVAL_SEC;
  }

  const next: Unit[] = [];
  for (const unit of units) {
    const hp = hpById.get(unit.id) ?? unit.hp;
    if (unit.kind === "enemy" && hp <= 0) {
      continue;
    }
    const slowLeft = slowLeftById.get(unit.id) ?? unit.slowLeft;
    const slowFactor = slowLeft > 0 ? (slowFactorById.get(unit.id) ?? unit.slowFactor) : 1;
    const same =
      hp === unit.hp && slowLeft === unit.slowLeft && slowFactor === unit.slowFactor;
    next.push(same ? unit : { ...unit, hp, slowLeft, slowFactor });
  }
  return { units: next, shots: live, fireCooldown: cooldown, nextShotId: shotId };
}

function applyProjectileHit(
  shot: TowerShot,
  target: Unit,
  units: readonly Unit[],
  hpById: Map<number, number>,
  slowLeftById: Map<number, number>,
  slowFactorById: Map<number, number>,
): void {
  applyDamage(hpById, target.id, target.hp, shot.damage);
  const stats = { typeId: shot.typeId, level: 1 };
  if (towerAttack(stats) === "splash") {
    const radius = towerSplashRadius(stats);
    for (const unit of units) {
      if (unit.kind !== "enemy" || unit.id === target.id) {
        continue;
      }
      const hp = hpById.get(unit.id) ?? unit.hp;
      if (!(hp > 0)) {
        continue;
      }
      if (Math.hypot(unit.x - target.x, unit.y - target.y) > radius) {
        continue;
      }
      applyDamage(hpById, unit.id, unit.hp, shot.damage);
    }
  }
  if (towerAttack(stats) === "slow") {
    const nextLeft = Math.max(slowLeftById.get(target.id) ?? 0, towerSlowSec(stats));
    slowLeftById.set(target.id, nextLeft);
    slowFactorById.set(
      target.id,
      Math.min(slowFactorById.get(target.id) ?? 1, towerSlowFactor(stats)),
    );
  }
}

function applyDamage(
  hpById: Map<number, number>,
  id: number,
  fallbackHp: number,
  amount: number,
): void {
  hpById.set(id, (hpById.get(id) ?? fallbackHp) - amount);
}

function nearestEnemyInRange(
  tower: Tower,
  units: readonly Unit[],
  hpById: ReadonlyMap<number, number>,
): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const unit of units) {
    if (unit.kind !== "enemy") {
      continue;
    }
    const hp = hpById.get(unit.id) ?? unit.hp;
    if (!(hp > 0)) {
      continue;
    }
    const dist = Math.hypot(unit.x - tower.x, unit.y - tower.y);
    if (dist > towerRange(tower)) {
      continue;
    }
    if (dist < bestDist) {
      best = unit;
      bestDist = dist;
    }
  }
  return best;
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
