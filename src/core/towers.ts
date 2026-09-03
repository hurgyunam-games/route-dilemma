/** Tower types, costs, and combat stats. Loaded from towers.json. */

import towerTable from "./towers.json";

export const TOWER_TYPE_IDS = ["archer", "cannon", "mage"] as const;
export type TowerTypeId = (typeof TOWER_TYPE_IDS)[number];

export const TOWER_ATTACK_IDS = ["single", "splash", "slow"] as const;
export type TowerAttackId = (typeof TOWER_ATTACK_IDS)[number];

export const TOWER_ATTACK_LABELS: Record<TowerAttackId, string> = {
  single: "단발",
  splash: "범위",
  slow: "감속",
};

export type TowerLevelStats = {
  readonly cost: number;
  readonly hp: number;
  readonly range: number;
  readonly dps: number;
};

export type TowerDef = {
  readonly id: TowerTypeId;
  readonly name: string;
  readonly attack: TowerAttackId;
  readonly splashRadius: number;
  readonly slowFactor: number;
  readonly slowSec: number;
  readonly cost: number;
  readonly hp: number;
  readonly range: number;
  readonly dps: number;
};

type TowerTypeRow = {
  readonly id: TowerTypeId;
  readonly name: string;
  readonly attack: TowerAttackId;
  readonly splashRadius: number;
  readonly slowFactor: number;
  readonly slowSec: number;
  readonly levels: readonly TowerLevelStats[];
};

const table = towerTable as {
  readonly buildDurationSec: number;
  readonly upgradeDurationSec: number;
  readonly maxLevel: number;
  readonly types: readonly TowerTypeRow[];
};

const byId = new Map<TowerTypeId, TowerTypeRow>();
for (const row of table.types) {
  byId.set(row.id, row);
}

export const BUILD_DURATION_SEC = table.buildDurationSec;
export const UPGRADE_DURATION_SEC = table.upgradeDurationSec;
export const TOWER_MAX_LEVEL = table.maxLevel;

export const TOWER_DEFS: Record<TowerTypeId, TowerDef> = {
  archer: toDef("archer"),
  cannon: toDef("cannon"),
  mage: toDef("mage"),
};

export const TOWER_CATALOG: readonly TowerDef[] = TOWER_TYPE_IDS.map(
  (id) => TOWER_DEFS[id],
);

/** Level-1 archer HP. Existing tests and default toggle placement use this. */
export const TOWER_MAX_HP = TOWER_DEFS.archer.hp;

export const DEFAULT_TOWER_TYPE: TowerTypeId = "archer";

export type TowerStatsKey = {
  readonly typeId: TowerTypeId;
  readonly level: number;
};

function toDef(id: TowerTypeId): TowerDef {
  const row = requireType(id);
  const base = requireLevel(row, 1);
  return {
    id: row.id,
    name: row.name,
    attack: row.attack,
    splashRadius: row.splashRadius,
    slowFactor: row.slowFactor,
    slowSec: row.slowSec,
    cost: base.cost,
    hp: base.hp,
    range: base.range,
    dps: base.dps,
  };
}

function requireType(id: TowerTypeId): TowerTypeRow {
  const row = byId.get(id);
  if (!row) {
    throw new Error(`Missing tower type ${id}`);
  }
  return row;
}

function requireLevel(row: TowerTypeRow, level: number): TowerLevelStats {
  const index = Math.min(TOWER_MAX_LEVEL, Math.max(1, Math.round(level))) - 1;
  const stats = row.levels[index];
  if (!stats) {
    throw new Error(`Missing ${row.id} level ${level}`);
  }
  return stats;
}

export function towerLevelStats(tower: TowerStatsKey): TowerLevelStats {
  return requireLevel(requireType(tower.typeId), tower.level);
}

export function towerBuildCost(typeId: TowerTypeId): number {
  return towerLevelStats({ typeId, level: 1 }).cost;
}

export function towerUpgradeCost(tower: TowerStatsKey): number {
  if (tower.level >= TOWER_MAX_LEVEL) {
    return 0;
  }
  return towerLevelStats({ typeId: tower.typeId, level: tower.level + 1 }).cost;
}

export function towerRange(tower: TowerStatsKey): number {
  return towerLevelStats(tower).range;
}

export function towerDps(tower: TowerStatsKey): number {
  return towerLevelStats(tower).dps;
}

export function towerMaxHp(tower: TowerStatsKey): number {
  return towerLevelStats(tower).hp;
}

export function towerAttack(tower: TowerStatsKey): TowerAttackId {
  return requireType(tower.typeId).attack;
}

export function towerSplashRadius(tower: TowerStatsKey): number {
  return requireType(tower.typeId).splashRadius;
}

export function towerSlowFactor(tower: TowerStatsKey): number {
  return requireType(tower.typeId).slowFactor;
}

export function towerSlowSec(tower: TowerStatsKey): number {
  return requireType(tower.typeId).slowSec;
}

export function towerWorkDuration(tower: { level: number }): number {
  return tower.level <= 1 ? BUILD_DURATION_SEC : UPGRADE_DURATION_SEC;
}

export function isTowerComplete(tower: { buildTimeLeft: number }): boolean {
  return !(tower.buildTimeLeft > 0);
}

export function canUpgrade(tower: {
  level: number;
  buildTimeLeft: number;
}): boolean {
  return isTowerComplete(tower) && tower.level < TOWER_MAX_LEVEL;
}
