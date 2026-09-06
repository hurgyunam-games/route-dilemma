/** Serialize campaign progress. Storage is injected so core stays DOM-free. */

import { createCampaign, type CampaignProgress, type MapTowerMap } from "./campaign";
import { isMapId, type MapId } from "./maps";
import { TOWER_MAX_LEVEL, TOWER_TYPE_IDS, type TowerTypeId } from "./towers";
import type { Tower } from "./grid";

export const CAMPAIGN_STORAGE_KEY = "maze-td.campaign.v1";

export type CampaignStore = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

type CampaignSave = {
  readonly version: 1;
  readonly clearedStage: number;
  readonly mapTowers: Record<string, unknown>;
};

function isTowerTypeId(value: unknown): value is TowerTypeId {
  return TOWER_TYPE_IDS.some((id) => id === value);
}

function parseTower(value: unknown): Tower | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const x = raw.x;
  const y = raw.y;
  const typeId = raw.typeId;
  const level = raw.level;
  const hp = raw.hp;
  const buildTimeLeft = raw.buildTimeLeft;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !isTowerTypeId(typeId) ||
    typeof level !== "number" ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > TOWER_MAX_LEVEL ||
    typeof hp !== "number" ||
    !(hp > 0) ||
    typeof buildTimeLeft !== "number" ||
    buildTimeLeft < 0
  ) {
    return null;
  }
  return {
    x,
    y,
    typeId,
    level,
    hp,
    buildTimeLeft,
  };
}

function parseMapTowers(value: unknown): MapTowerMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Partial<Record<MapId, readonly Tower[]>> = {};
  for (const [key, towers] of Object.entries(value as Record<string, unknown>)) {
    const id = Number(key);
    if (!isMapId(id) || !Array.isArray(towers)) {
      continue;
    }
    next[id] = towers
      .map(parseTower)
      .filter((tower): tower is Tower => tower !== null);
  }
  return next;
}

export function serializeCampaign(progress: CampaignProgress): string {
  const save: CampaignSave = {
    version: 1,
    clearedStage: progress.clearedStage,
    mapTowers: Object.fromEntries(
      Object.entries(progress.mapTowers).map(([id, towers]) => [id, towers]),
    ),
  };
  return JSON.stringify(save);
}

export function parseCampaign(raw: string | null): CampaignProgress {
  if (raw === null || raw === "") {
    return createCampaign();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createCampaign();
  }
  if (!parsed || typeof parsed !== "object") {
    return createCampaign();
  }
  const body = parsed as Partial<CampaignSave>;
  const clearedStage = Math.max(0, Math.round(Number(body.clearedStage)));
  if (!Number.isFinite(clearedStage)) {
    return createCampaign();
  }
  return {
    clearedStage,
    mapTowers: parseMapTowers(body.mapTowers),
  };
}

export function loadCampaign(store: CampaignStore): CampaignProgress {
  try {
    return parseCampaign(store.getItem(CAMPAIGN_STORAGE_KEY));
  } catch {
    return createCampaign();
  }
}

export function persistCampaign(store: CampaignStore, progress: CampaignProgress): void {
  store.setItem(CAMPAIGN_STORAGE_KEY, serializeCampaign(progress));
}
