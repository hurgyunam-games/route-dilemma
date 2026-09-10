/** Serialize campaign progress. Storage is injected so core stays DOM-free. */

import { createCampaign, type CampaignProgress, type MapTowerMap } from "./campaign";
import { isMapId, type MapId } from "./maps";
import { TOWER_MAX_LEVEL, TOWER_TYPE_IDS, type TowerTypeId } from "./towers";
import type { Tower } from "./grid";
import { version as npmVersion } from "../../package.json";

/** Schema integer. Bump only when the save *shape* changes, then add a migrateStep. */
export const CAMPAIGN_SAVE_VERSION = 1;

/** Debug string written into saves. Comes from package.json. */
export const APP_VERSION = npmVersion;

export const CAMPAIGN_STORAGE_KEY = "route-dilemma.campaign";

/** Older keys; load still reads them, persist copies forward and drops them. */
export const LEGACY_CAMPAIGN_STORAGE_KEYS = ["maze-td.campaign.v1"] as const;

export type CampaignStore = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem?: (key: string) => void;
};

export type CampaignLoadStatus = "ok" | "empty" | "invalid" | "newer" | "migrated";

export type CampaignLoad = {
  readonly status: CampaignLoadStatus;
  readonly progress: CampaignProgress;
  readonly saveVersion: number | null;
};

type RawSave = Record<string, unknown>;

type CampaignSave = {
  readonly version: number;
  readonly appVersion: string;
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

function asRawSave(value: unknown): RawSave | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as RawSave;
}

function readSaveVersion(body: RawSave): number | "invalid" | "missing" {
  if (!("version" in body) || body.version === undefined) {
    return "missing";
  }
  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return "invalid";
  }
  return version;
}

/**
 * Walk schema versions up to CAMPAIGN_SAVE_VERSION.
 * When the shape changes, add `case n: return migrateVnToVn1(body)`.
 */
function migrateStep(_body: RawSave, fromVersion: number): RawSave | "invalid" {
  switch (fromVersion) {
    // case 1: return migrateV1toV2(_body);
    default:
      return "invalid";
  }
}

function migrateSave(body: RawSave, fromVersion: number): RawSave | "invalid" {
  let version = fromVersion;
  let current: RawSave = { ...body };
  while (version < CAMPAIGN_SAVE_VERSION) {
    const next = migrateStep(current, version);
    if (next === "invalid") {
      return "invalid";
    }
    current = next;
    version += 1;
  }
  return { ...current, version: CAMPAIGN_SAVE_VERSION };
}

function progressFromSave(body: RawSave): CampaignProgress | null {
  const clearedStage = Math.max(0, Math.round(Number(body.clearedStage)));
  if (!Number.isFinite(clearedStage)) {
    return null;
  }
  return {
    clearedStage,
    mapTowers: parseMapTowers(body.mapTowers),
  };
}

const emptyLoad = (status: CampaignLoadStatus, saveVersion: number | null = null): CampaignLoad => ({
  status,
  progress: createCampaign(),
  saveVersion,
});

export function serializeCampaign(progress: CampaignProgress): string {
  const save: CampaignSave = {
    version: CAMPAIGN_SAVE_VERSION,
    appVersion: APP_VERSION,
    clearedStage: progress.clearedStage,
    mapTowers: Object.fromEntries(
      Object.entries(progress.mapTowers).map(([id, towers]) => [id, towers]),
    ),
  };
  return JSON.stringify(save);
}

export function parseCampaignSave(raw: string | null): CampaignLoad {
  if (raw === null || raw === "") {
    return emptyLoad("empty");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyLoad("invalid");
  }
  const body = asRawSave(parsed);
  if (!body) {
    return emptyLoad("invalid");
  }
  const version = readSaveVersion(body);
  if (version === "invalid") {
    return emptyLoad("invalid");
  }
  const fromVersion = version === "missing" ? 1 : version;
  if (fromVersion > CAMPAIGN_SAVE_VERSION) {
    return emptyLoad("newer", fromVersion);
  }
  const migratedBody = migrateSave(body, fromVersion);
  if (migratedBody === "invalid") {
    return emptyLoad("invalid", fromVersion);
  }
  const progress = progressFromSave(migratedBody);
  if (progress === null) {
    return emptyLoad("invalid", fromVersion);
  }
  const migrated = version === "missing" || fromVersion < CAMPAIGN_SAVE_VERSION;
  return {
    status: migrated ? "migrated" : "ok",
    progress,
    saveVersion: CAMPAIGN_SAVE_VERSION,
  };
}

export function parseCampaign(raw: string | null): CampaignProgress {
  return parseCampaignSave(raw).progress;
}

function readStoredCampaign(store: CampaignStore): { raw: string; fromLegacy: boolean } | null {
  const current = store.getItem(CAMPAIGN_STORAGE_KEY);
  if (current !== null && current !== "") {
    return { raw: current, fromLegacy: false };
  }
  for (const key of LEGACY_CAMPAIGN_STORAGE_KEYS) {
    const raw = store.getItem(key);
    if (raw !== null && raw !== "") {
      return { raw, fromLegacy: true };
    }
  }
  return null;
}

export function loadCampaign(store: CampaignStore): CampaignLoad {
  try {
    const stored = readStoredCampaign(store);
    if (stored === null) {
      return emptyLoad("empty");
    }
    const loaded = parseCampaignSave(stored.raw);
    if (stored.fromLegacy && (loaded.status === "ok" || loaded.status === "migrated")) {
      const migrated: CampaignLoad = { ...loaded, status: "migrated" };
      persistCampaign(store, migrated.progress);
      return migrated;
    }
    if (loaded.status === "migrated") {
      persistCampaign(store, loaded.progress);
    }
    return loaded;
  } catch {
    return emptyLoad("invalid");
  }
}

export function persistCampaign(store: CampaignStore, progress: CampaignProgress): boolean {
  const existing = store.getItem(CAMPAIGN_STORAGE_KEY);
  if (existing !== null && existing !== "") {
    const parsed = parseCampaignSave(existing);
    if (parsed.status === "newer") {
      return false;
    }
  }
  store.setItem(CAMPAIGN_STORAGE_KEY, serializeCampaign(progress));
  if (store.removeItem) {
    for (const key of LEGACY_CAMPAIGN_STORAGE_KEYS) {
      store.removeItem(key);
    }
  }
  return true;
}
