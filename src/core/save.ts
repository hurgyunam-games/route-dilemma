/** Serialize a list of campaign saves. Storage is injected so core stays DOM-free. */

import {
  createCampaign,
  type CampaignProgress,
  type MapRecaptureMap,
  type MapTowerMap,
} from "./campaign";
import { isMapId, type MapId } from "./maps";
import { TOWER_MAX_LEVEL, TOWER_TYPE_IDS, type TowerTypeId } from "./towers";
import type { Tower } from "./grid";
import { isSpecialBehavior, type SpecialBehaviorId } from "./bestiary";
import { isResearchBuffId, STARTER_RESEARCH_POINTS, type ResearchBuffId } from "./research";
import { version as npmVersion } from "../../package.json";

/** Schema integer. Bump only when the save *shape* changes, then add a migrateStep. */
export const CAMPAIGN_SAVE_VERSION = 6;

/** Envelope around the slot list. Bump only when that envelope changes. */
export const SAVE_LIST_VERSION = 1;

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

export type SaveSlot = {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: number;
  readonly progress: CampaignProgress;
  readonly status: CampaignLoadStatus;
};

export type SaveList = {
  readonly slots: readonly SaveSlot[];
};

export type SaveListLoad = {
  readonly status: CampaignLoadStatus;
  readonly list: SaveList;
  /** Original campaign JSON for slots this build must write back unchanged. */
  readonly preserved: Readonly<Record<string, string>>;
};

type RawSave = Record<string, unknown>;

type CampaignSave = {
  readonly version: number;
  readonly appVersion: string;
  readonly clearedStage: number;
  readonly mapTowers: Record<string, unknown>;
  readonly mapRecaptureAt: Record<string, unknown>;
  readonly bestiaryUnlocked: readonly string[];
  readonly warnedBehaviors: readonly SpecialBehaviorId[];
  readonly researchPoints: number;
  readonly researchBuffs: readonly ResearchBuffId[];
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

function parseMapRecaptureAt(value: unknown): MapRecaptureMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const next: Partial<Record<MapId, number>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const id = Number(key);
    if (!isMapId(id) || typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    next[id] = raw;
  }
  return next;
}

function parseBestiaryUnlocked(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item === "" || seen.has(item)) {
      continue;
    }
    seen.add(item);
    next.push(item);
  }
  return next;
}

function parseWarnedBehaviors(value: unknown): readonly SpecialBehaviorId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: SpecialBehaviorId[] = [];
  const seen = new Set<SpecialBehaviorId>();
  for (const item of value) {
    if (typeof item !== "string" || !isSpecialBehavior(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    next.push(item);
  }
  return next;
}

function parseResearchPoints(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function parseResearchBuffs(value: unknown): readonly ResearchBuffId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: ResearchBuffId[] = [];
  const seen = new Set<ResearchBuffId>();
  for (const item of value) {
    if (!isResearchBuffId(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    next.push(item);
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
function migrateV1toV2(body: RawSave): RawSave {
  return {
    ...body,
    mapRecaptureAt:
      body.mapRecaptureAt && typeof body.mapRecaptureAt === "object"
        ? body.mapRecaptureAt
        : {},
  };
}

function migrateV2toV3(body: RawSave): RawSave {
  return {
    ...body,
    bestiaryUnlocked: Array.isArray(body.bestiaryUnlocked) ? body.bestiaryUnlocked : [],
  };
}

function migrateV3toV4(body: RawSave): RawSave {
  return {
    ...body,
    researchPoints: typeof body.researchPoints === "number" ? body.researchPoints : 0,
    researchBuffs: Array.isArray(body.researchBuffs) ? body.researchBuffs : [],
  };
}

function migrateV4toV5(body: RawSave): RawSave {
  return {
    ...body,
    warnedBehaviors: Array.isArray(body.warnedBehaviors) ? body.warnedBehaviors : [],
  };
}

/** Old campaigns could build every tower. Give them the research-tower unlock cost once. */
function migrateV5toV6(body: RawSave): RawSave {
  const buffs = Array.isArray(body.researchBuffs) ? body.researchBuffs : [];
  if (buffs.includes("unlockResearch")) {
    return body;
  }
  const points =
    typeof body.researchPoints === "number" && Number.isFinite(body.researchPoints)
      ? body.researchPoints
      : 0;
  if (points >= STARTER_RESEARCH_POINTS) {
    return body;
  }
  return { ...body, researchPoints: STARTER_RESEARCH_POINTS };
}

function migrateStep(body: RawSave, fromVersion: number): RawSave | "invalid" {
  switch (fromVersion) {
    case 1:
      return migrateV1toV2(body);
    case 2:
      return migrateV2toV3(body);
    case 3:
      return migrateV3toV4(body);
    case 4:
      return migrateV4toV5(body);
    case 5:
      return migrateV5toV6(body);
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
    mapRecaptureAt: parseMapRecaptureAt(body.mapRecaptureAt),
    bestiaryUnlocked: parseBestiaryUnlocked(body.bestiaryUnlocked),
    warnedBehaviors: parseWarnedBehaviors(body.warnedBehaviors),
    researchPoints: parseResearchPoints(body.researchPoints),
    researchBuffs: parseResearchBuffs(body.researchBuffs),
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
    mapRecaptureAt: Object.fromEntries(
      Object.entries(progress.mapRecaptureAt ?? {}).map(([id, at]) => [id, at]),
    ),
    bestiaryUnlocked: [...(progress.bestiaryUnlocked ?? [])],
    warnedBehaviors: parseWarnedBehaviors(progress.warnedBehaviors),
    researchPoints: parseResearchPoints(progress.researchPoints),
    researchBuffs: [...(progress.researchBuffs ?? [])],
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

const SAVE_ID_MAX = 64;
const SAVE_NAME_MAX = 40;
const LEGACY_SLOT_ID = "s1";

function emptyListLoad(status: CampaignLoadStatus): SaveListLoad {
  return { status, list: { slots: [] }, preserved: {} };
}

function isSaveListBody(body: RawSave): boolean {
  return Array.isArray(body.slots);
}

function readListVersion(body: RawSave): number | "invalid" | "missing" {
  if (!("listVersion" in body) || body.listVersion === undefined) {
    return "missing";
  }
  const version = body.listVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return "invalid";
  }
  return version;
}

function aggregateListStatus(slots: readonly SaveSlot[], listMigrated: boolean): CampaignLoadStatus {
  if (listMigrated || slots.some((slot) => slot.status === "migrated")) {
    return "migrated";
  }
  return "ok";
}

function invalidSlot(id: string, name: string, updatedAt: number): SaveSlot {
  return {
    id,
    name,
    updatedAt,
    progress: createCampaign(),
    status: "invalid",
  };
}

function parseSaveSlot(value: unknown, preserved: Record<string, string>): SaveSlot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== "string" || id.trim() === "" || id.length > SAVE_ID_MAX) {
    return null;
  }
  const trimmedName = typeof raw.name === "string" ? raw.name.trim().slice(0, SAVE_NAME_MAX) : "";
  const name = trimmedName === "" ? "세이브" : trimmedName;
  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt) && raw.updatedAt > 0
      ? raw.updatedAt
      : 0;
  if (!("campaign" in raw)) {
    return invalidSlot(id, name, updatedAt);
  }
  let campaignJson: string;
  try {
    campaignJson = JSON.stringify(raw.campaign);
  } catch {
    return invalidSlot(id, name, updatedAt);
  }
  const loaded = parseCampaignSave(campaignJson);
  if (loaded.status === "empty") {
    return invalidSlot(id, name, updatedAt);
  }
  if (loaded.status === "newer") {
    preserved[id] = campaignJson;
  }
  return {
    id,
    name,
    updatedAt,
    progress: loaded.progress,
    status: loaded.status,
  };
}

function listFromLegacyCampaign(raw: string): SaveListLoad {
  const loaded = parseCampaignSave(raw);
  if (loaded.status === "empty" || loaded.status === "invalid") {
    return emptyListLoad(loaded.status);
  }
  const preserved: Record<string, string> = {};
  if (loaded.status === "newer") {
    preserved[LEGACY_SLOT_ID] = raw;
  }
  return {
    status: loaded.status === "newer" ? "newer" : "migrated",
    list: {
      slots: [
        {
          id: LEGACY_SLOT_ID,
          name: "세이브 1",
          updatedAt: 0,
          progress: loaded.progress,
          status: loaded.status === "ok" ? "migrated" : loaded.status,
        },
      ],
    },
    preserved,
  };
}

export function parseSaveList(raw: string | null): SaveListLoad {
  if (raw === null || raw === "") {
    return emptyListLoad("empty");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyListLoad("invalid");
  }
  const body = asRawSave(parsed);
  if (!body) {
    return emptyListLoad("invalid");
  }
  if (!isSaveListBody(body)) {
    return listFromLegacyCampaign(raw);
  }
  const version = readListVersion(body);
  if (version === "invalid") {
    return emptyListLoad("invalid");
  }
  if (version !== "missing" && version > SAVE_LIST_VERSION) {
    return emptyListLoad("newer");
  }
  const preserved: Record<string, string> = {};
  const slots: SaveSlot[] = [];
  const seen = new Set<string>();
  for (const entry of body.slots as readonly unknown[]) {
    const slot = parseSaveSlot(entry, preserved);
    if (slot === null || seen.has(slot.id)) {
      continue;
    }
    seen.add(slot.id);
    slots.push(slot);
  }
  const listMigrated = version === "missing";
  return {
    status: aggregateListStatus(slots, listMigrated),
    list: { slots },
    preserved,
  };
}

function createSaveId(slots: readonly SaveSlot[], now: number): string {
  const stamp = Number.isFinite(now) ? Math.trunc(Math.abs(now)).toString(36) : "0";
  const used = new Set(slots.map((slot) => slot.id));
  let id = `s${stamp}`;
  let n = 0;
  while (used.has(id)) {
    n += 1;
    id = `s${stamp}-${n}`;
  }
  return id;
}

function createSaveName(slots: readonly SaveSlot[]): string {
  let max = 0;
  for (const slot of slots) {
    const match = /^세이브 (\d+)$/.exec(slot.name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `세이브 ${max + 1}`;
}

export function addSaveSlot(list: SaveList, now: number): { readonly list: SaveList; readonly slot: SaveSlot } {
  const slot: SaveSlot = {
    id: createSaveId(list.slots, now),
    name: createSaveName(list.slots),
    updatedAt: Number.isFinite(now) && now > 0 ? now : 0,
    progress: createCampaign(),
    status: "ok",
  };
  return { list: { slots: [...list.slots, slot] }, slot };
}

export function removeSaveSlot(list: SaveList, id: string): SaveList {
  return { slots: list.slots.filter((slot) => slot.id !== id) };
}

export function updateSaveSlot(
  list: SaveList,
  id: string,
  progress: CampaignProgress,
  now: number,
): SaveList {
  return {
    slots: list.slots.map((slot) => {
      if (slot.id !== id || slot.status === "newer") {
        return slot;
      }
      return {
        ...slot,
        progress,
        updatedAt: Number.isFinite(now) && now > 0 ? now : slot.updatedAt,
        status: "ok",
      };
    }),
  };
}

function campaignPayload(
  slot: SaveSlot,
  preserved: Readonly<Record<string, string>>,
): unknown | null {
  if (slot.status === "newer") {
    const raw = preserved[slot.id];
    if (raw === undefined) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  }
  return JSON.parse(serializeCampaign(slot.progress)) as unknown;
}

export function serializeSaveList(
  list: SaveList,
  preserved: Readonly<Record<string, string>> = {},
): string | null {
  const slots: { id: string; name: string; updatedAt: number; campaign: unknown }[] = [];
  for (const slot of list.slots) {
    const campaign = campaignPayload(slot, preserved);
    if (campaign === null) {
      return null;
    }
    slots.push({
      id: slot.id,
      name: slot.name,
      updatedAt: slot.updatedAt,
      campaign,
    });
  }
  return JSON.stringify({ listVersion: SAVE_LIST_VERSION, slots });
}

function storedSaveIsNewer(raw: string | null): boolean {
  if (raw === null || raw === "") {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const body = asRawSave(parsed);
  if (!body) {
    return false;
  }
  if (Array.isArray(body.slots)) {
    const version = body.listVersion;
    return typeof version === "number" && Number.isInteger(version) && version > SAVE_LIST_VERSION;
  }
  const version = readSaveVersion(body);
  return typeof version === "number" && version > CAMPAIGN_SAVE_VERSION;
}

function anyStoredSaveIsNewer(store: CampaignStore): boolean {
  const current = store.getItem(CAMPAIGN_STORAGE_KEY);
  if (storedSaveIsNewer(current)) {
    return true;
  }
  if (current !== null && current !== "") {
    return false;
  }
  for (const key of LEGACY_CAMPAIGN_STORAGE_KEYS) {
    if (storedSaveIsNewer(store.getItem(key))) {
      return true;
    }
  }
  return false;
}

export function persistSaveList(
  store: CampaignStore,
  list: SaveList,
  preserved: Readonly<Record<string, string>> = {},
): boolean {
  try {
    if (anyStoredSaveIsNewer(store)) {
      return false;
    }
    const raw = serializeSaveList(list, preserved);
    if (raw === null) {
      return false;
    }
    store.setItem(CAMPAIGN_STORAGE_KEY, raw);
    if (store.removeItem) {
      for (const key of LEGACY_CAMPAIGN_STORAGE_KEYS) {
        store.removeItem(key);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function loadSaveList(store: CampaignStore): SaveListLoad {
  try {
    const stored = readStoredCampaign(store);
    if (stored === null) {
      return emptyListLoad("empty");
    }
    const loaded = parseSaveList(stored.raw);
    const shouldRewrite = loaded.status === "migrated" || (stored.fromLegacy && loaded.status === "ok");
    if (!shouldRewrite) {
      return loaded;
    }
    const migrated: SaveListLoad = { ...loaded, status: "migrated" };
    if (persistSaveList(store, migrated.list, migrated.preserved)) {
      return migrated;
    }
    return loaded;
  } catch {
    return emptyListLoad("invalid");
  }
}
