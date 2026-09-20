/** Campaign stages loop the five world maps; each map keeps its towers. */

import { type Tower } from "./grid";
import { WORLD_MAP_COUNT, WORLD_MAPS, type GameMapDef, type MapId } from "./maps";
import { towerMaxHp } from "./towers";

export type MapTowerMap = Readonly<Partial<Record<MapId, readonly Tower[]>>>;
export type MapRecaptureMap = Readonly<Partial<Record<MapId, number>>>;

/** Wall-clock wait after Game Over before the lost map can be entered again. */
export const RECAPTURE_DURATION_MS = 30_000;
export const DEFEAT_HP_MIN_RATIO = 0.1;
export const DEFEAT_HP_MAX_RATIO = 0.3;

export type CampaignProgress = {
  readonly clearedStage: number;
  readonly mapTowers: MapTowerMap;
  readonly mapRecaptureAt: MapRecaptureMap;
};

export type CampaignMapStatus = {
  readonly map: GameMapDef;
  readonly mapId: MapId;
  readonly stageId: number;
  readonly unlocked: boolean;
  readonly cleared: boolean;
  readonly current: boolean;
  readonly recapturing: boolean;
  readonly recaptureRemainingMs: number;
  readonly towers: readonly Tower[];
};

export function createCampaign(): CampaignProgress {
  return { clearedStage: 0, mapTowers: {}, mapRecaptureAt: {} };
}

export function mapIdForStage(stageId: number): MapId {
  const stage = Math.round(stageId);
  if (!Number.isInteger(stage) || stage < 1) {
    throw new Error(`Unknown campaign stage ${stageId}`);
  }
  return (((stage - 1) % WORLD_MAP_COUNT) + 1) as MapId;
}

export function playableStage(progress: CampaignProgress, mapId: MapId): number {
  const next = currentStage(progress);
  if (mapIdForStage(next) === mapId) {
    return next;
  }
  let stage = mapId;
  while (stage + WORLD_MAP_COUNT <= progress.clearedStage) {
    stage += WORLD_MAP_COUNT;
  }
  return stage;
}

export function currentStage(progress: CampaignProgress): number {
  return Math.max(1, progress.clearedStage + 1);
}

export function isMapUnlocked(progress: CampaignProgress, mapId: MapId): boolean {
  return mapId <= currentStage(progress);
}

export function recaptureRemainingMs(
  progress: CampaignProgress,
  mapId: MapId,
  nowMs: number,
): number {
  const until = progress.mapRecaptureAt[mapId];
  if (until === undefined) {
    return 0;
  }
  return Math.max(0, until - nowMs);
}

export function isMapRecapturing(
  progress: CampaignProgress,
  mapId: MapId,
  nowMs: number,
): boolean {
  return recaptureRemainingMs(progress, mapId, nowMs) > 0;
}

export function canEnterMap(
  progress: CampaignProgress,
  mapId: MapId,
  nowMs: number,
): boolean {
  return isMapUnlocked(progress, mapId) && !isMapRecapturing(progress, mapId, nowMs);
}

export function isMapCleared(progress: CampaignProgress, mapId: MapId): boolean {
  return mapId <= progress.clearedStage;
}

export function towersForMap(progress: CampaignProgress, mapId: MapId): readonly Tower[] {
  return progress.mapTowers[mapId] ?? [];
}

export function saveMapTowers(
  progress: CampaignProgress,
  mapId: MapId,
  towers: readonly Tower[],
): CampaignProgress {
  const next = towers.map((tower) => ({ ...tower }));
  const prev = towersForMap(progress, mapId);
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return progress;
  }
  return {
    ...progress,
    mapTowers: { ...progress.mapTowers, [mapId]: next },
  };
}

export function campaignMapStatuses(
  progress: CampaignProgress,
  nowMs: number = Date.now(),
): readonly CampaignMapStatus[] {
  const nextStage = currentStage(progress);
  const currentMap = mapIdForStage(nextStage);
  return WORLD_MAPS.map((map) => {
    const cleared = isMapCleared(progress, map.id);
    const remaining = recaptureRemainingMs(progress, map.id, nowMs);
    return {
      map,
      mapId: map.id,
      stageId: playableStage(progress, map.id),
      unlocked: isMapUnlocked(progress, map.id),
      cleared,
      current: map.id === currentMap,
      recapturing: remaining > 0,
      recaptureRemainingMs: remaining,
      towers: towersForMap(progress, map.id),
    };
  });
}

export function recordVictory(
  progress: CampaignProgress,
  stageId: number,
): CampaignProgress {
  const stage = Math.round(stageId);
  if (stage !== currentStage(progress) || stage < 1) {
    return progress;
  }
  return { ...progress, clearedStage: stage };
}

function shuffleTowers(towers: readonly Tower[], random: () => number): Tower[] {
  const next = [...towers].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = next[i]!;
    next[i] = next[j]!;
    next[j] = swap;
  }
  return next;
}

/** Destroy about half the towers; survivors keep 10%–30% of max HP. */
export function applyDefeatTowerLoss(
  towers: readonly Tower[],
  random: () => number = Math.random,
): readonly Tower[] {
  if (towers.length === 0) {
    return towers;
  }
  const shuffled = shuffleTowers(towers, random);
  const kept = shuffled.slice(Math.floor(shuffled.length / 2));
  return kept
    .map((tower) => {
      const maxHp = towerMaxHp(tower);
      const roll = Math.min(1, Math.max(0, random()));
      const ratio =
        DEFEAT_HP_MIN_RATIO + roll * (DEFEAT_HP_MAX_RATIO - DEFEAT_HP_MIN_RATIO);
      return { ...tower, hp: maxHp * ratio };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function recordDefeat(
  progress: CampaignProgress,
  mapId: MapId,
  towers: readonly Tower[],
  nowMs: number,
  random: () => number = Math.random,
): CampaignProgress {
  const nextTowers = applyDefeatTowerLoss(towers, random);
  const prev = towersForMap(progress, mapId);
  const sameTowers = JSON.stringify(prev) === JSON.stringify(nextTowers);
  return startMapRecapture(
    {
      ...progress,
      mapTowers: sameTowers
        ? progress.mapTowers
        : { ...progress.mapTowers, [mapId]: [...nextTowers] },
    },
    mapId,
    nowMs,
  );
}

/** Restart the recapture wait so leaving to the world map always blocks re-entry. */
export function startMapRecapture(
  progress: CampaignProgress,
  mapId: MapId,
  nowMs: number,
): CampaignProgress {
  const until = nowMs + RECAPTURE_DURATION_MS;
  if (progress.mapRecaptureAt[mapId] === until) {
    return progress;
  }
  return {
    ...progress,
    mapRecaptureAt: {
      ...progress.mapRecaptureAt,
      [mapId]: until,
    },
  };
}
