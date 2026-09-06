/** Campaign stages loop the five world maps; each map keeps its towers. */

import { type Tower } from "./grid";
import { WORLD_MAP_COUNT, WORLD_MAPS, type GameMapDef, type MapId } from "./maps";

export type MapTowerMap = Readonly<Partial<Record<MapId, readonly Tower[]>>>;

export type CampaignProgress = {
  readonly clearedStage: number;
  readonly mapTowers: MapTowerMap;
};

export type CampaignMapStatus = {
  readonly map: GameMapDef;
  readonly mapId: MapId;
  readonly stageId: number;
  readonly unlocked: boolean;
  readonly cleared: boolean;
  readonly current: boolean;
  readonly towers: readonly Tower[];
};

export function createCampaign(): CampaignProgress {
  return { clearedStage: 0, mapTowers: {} };
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
): readonly CampaignMapStatus[] {
  const nextStage = currentStage(progress);
  const currentMap = mapIdForStage(nextStage);
  return WORLD_MAPS.map((map) => {
    const cleared = isMapCleared(progress, map.id);
    return {
      map,
      mapId: map.id,
      stageId: playableStage(progress, map.id),
      unlocked: isMapUnlocked(progress, map.id),
      cleared,
      current: map.id === currentMap,
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
