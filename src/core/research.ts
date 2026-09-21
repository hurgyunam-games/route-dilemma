/** Global research points and world-map buffs. Shared across every map. */

import { isTowerComplete, type TowerTypeId } from "./towers";

export const RESEARCH_BUFF_IDS = ["damage", "range", "startGold", "allyGold"] as const;
export type ResearchBuffId = (typeof RESEARCH_BUFF_IDS)[number];

export type ResearchBuffDef = {
  readonly id: ResearchBuffId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
};

/** Points a finished research tower of the given level makes each second. */
export const RESEARCH_POINT_PER_SEC = 0.25;
export const RESEARCH_DAMAGE_MUL = 1.25;
export const RESEARCH_RANGE_ADD = 0.5;
export const RESEARCH_START_GOLD = 20;
export const RESEARCH_ALLY_GOLD_MUL = 1.5;

export const RESEARCH_BUFFS: readonly ResearchBuffDef[] = [
  {
    id: "damage",
    name: "화력 연구",
    description: "모든 맵의 타워 공격력이 늘어납니다.",
    cost: 8,
  },
  {
    id: "range",
    name: "조준 연구",
    description: "모든 맵의 타워 사거리가 늘어납니다.",
    cost: 10,
  },
  {
    id: "startGold",
    name: "보급 연구",
    description: "모든 맵의 시작 골드가 늘어납니다.",
    cost: 6,
  },
  {
    id: "allyGold",
    name: "수송 연구",
    description: "모든 맵에서 아군이 가져오는 골드가 늘어납니다.",
    cost: 12,
  },
];

const buffById = new Map<ResearchBuffId, ResearchBuffDef>(
  RESEARCH_BUFFS.map((buff) => [buff.id, buff]),
);

export type ResearchProgress = {
  readonly researchPoints: number;
  readonly researchBuffs: readonly ResearchBuffId[];
};

export function isResearchBuffId(value: unknown): value is ResearchBuffId {
  return RESEARCH_BUFF_IDS.some((id) => id === value);
}

export function getResearchBuff(id: ResearchBuffId): ResearchBuffDef {
  const buff = buffById.get(id);
  if (!buff) {
    throw new Error(`Unknown research buff ${id}`);
  }
  return buff;
}

export function hasResearchBuff(
  buffs: readonly ResearchBuffId[],
  id: ResearchBuffId,
): boolean {
  return buffs.includes(id);
}

export function isResearchTower(typeId: TowerTypeId): boolean {
  return typeId === "research";
}

export function researchPointRateForLevel(level: number): number {
  return RESEARCH_POINT_PER_SEC * Math.max(1, Math.round(level));
}

export function researchPointRate(
  towers: readonly {
    readonly typeId: TowerTypeId;
    readonly level: number;
    readonly buildTimeLeft: number;
  }[],
): number {
  let rate = 0;
  for (const tower of towers) {
    if (!isResearchTower(tower.typeId) || !isTowerComplete(tower)) {
      continue;
    }
    rate += researchPointRateForLevel(tower.level);
  }
  return rate;
}

export function accrueResearchPoints(
  points: number,
  towers: readonly {
    readonly typeId: TowerTypeId;
    readonly level: number;
    readonly buildTimeLeft: number;
  }[],
  dt: number,
): number {
  if (!(dt > 0)) {
    return points;
  }
  const rate = researchPointRate(towers);
  if (!(rate > 0)) {
    return points;
  }
  return points + rate * dt;
}

export function researchDamageMul(buffs: readonly ResearchBuffId[]): number {
  return hasResearchBuff(buffs, "damage") ? RESEARCH_DAMAGE_MUL : 1;
}

export function researchRangeAdd(buffs: readonly ResearchBuffId[]): number {
  return hasResearchBuff(buffs, "range") ? RESEARCH_RANGE_ADD : 0;
}

export function researchStartGoldBonus(buffs: readonly ResearchBuffId[]): number {
  return hasResearchBuff(buffs, "startGold") ? RESEARCH_START_GOLD : 0;
}

export function researchAllyGoldMul(buffs: readonly ResearchBuffId[]): number {
  return hasResearchBuff(buffs, "allyGold") ? RESEARCH_ALLY_GOLD_MUL : 1;
}

export function modifiedTowerRange(
  range: number,
  buffs: readonly ResearchBuffId[],
): number {
  if (!(range > 0)) {
    return range;
  }
  return range + researchRangeAdd(buffs);
}

export function modifiedTowerDps(
  dps: number,
  buffs: readonly ResearchBuffId[],
): number {
  if (!(dps > 0)) {
    return dps;
  }
  return dps * researchDamageMul(buffs);
}

export function saveResearchPoints<T extends ResearchProgress>(
  progress: T,
  points: number,
): T {
  const next = Math.max(0, points);
  if (progress.researchPoints === next) {
    return progress;
  }
  return { ...progress, researchPoints: next };
}

export type UnlockResearchResult<T extends ResearchProgress> =
  | { readonly ok: true; readonly progress: T }
  | { readonly ok: false; readonly reason: string };

export function unlockResearchBuff<T extends ResearchProgress>(
  progress: T,
  buffId: ResearchBuffId,
): UnlockResearchResult<T> {
  if (!isResearchBuffId(buffId)) {
    return { ok: false, reason: "없는 연구입니다" };
  }
  if (hasResearchBuff(progress.researchBuffs, buffId)) {
    return { ok: false, reason: "이미 고른 버프입니다" };
  }
  const cost = getResearchBuff(buffId).cost;
  if (progress.researchPoints < cost) {
    return {
      ok: false,
      reason: `연구 포인트가 부족합니다 (필요 ${cost}, 보유 ${Math.floor(progress.researchPoints)})`,
    };
  }
  return {
    ok: true,
    progress: {
      ...progress,
      researchPoints: progress.researchPoints - cost,
      researchBuffs: [...progress.researchBuffs, buffId],
    },
  };
}
