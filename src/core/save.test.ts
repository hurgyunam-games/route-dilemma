import { describe, expect, it } from "vitest";
import { createCampaign, saveMapTowers } from "./campaign";
import { placeTower } from "./grid";
import { createMapGrid } from "./maps";
import {
  APP_VERSION,
  CAMPAIGN_SAVE_VERSION,
  CAMPAIGN_STORAGE_KEY,
  LEGACY_CAMPAIGN_STORAGE_KEYS,
  loadCampaign,
  parseCampaign,
  parseCampaignSave,
  persistCampaign,
  serializeCampaign,
  type CampaignStore,
} from "./save";

function memoryStore(initial: Record<string, string> = {}): CampaignStore & {
  readonly data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("campaign save", () => {
  it("round-trips cleared stages and map towers through storage", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "wall", 0);
    let progress = createCampaign();
    for (let id = 1; id <= 5; id += 1) {
      progress = { ...progress, clearedStage: id };
    }
    progress = saveMapTowers(progress, 1, plains.towers);
    const store = memoryStore();
    expect(persistCampaign(store, progress)).toBe(true);
    expect(store.data[CAMPAIGN_STORAGE_KEY]).toEqual(serializeCampaign(progress));
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("ok");
    expect(loaded.progress.clearedStage).toBe(5);
    expect(loaded.progress.mapTowers[1]).toEqual(plains.towers);
    expect(parseCampaign(null)).toEqual(createCampaign());
    expect(parseCampaign("not-json")).toEqual(createCampaign());
  });

  it("writes schema version and app version into the save json", () => {
    const body = JSON.parse(serializeCampaign(createCampaign())) as {
      version: number;
      appVersion: string;
    };
    expect(body.version).toBe(CAMPAIGN_SAVE_VERSION);
    expect(body.appVersion).toBe(APP_VERSION);
  });

  it("treats a missing version as schema 1 and marks the load migrated", () => {
    const loaded = parseCampaignSave(
      JSON.stringify({ clearedStage: 2, mapTowers: {} }),
    );
    expect(loaded.status).toBe("migrated");
    expect(loaded.progress.clearedStage).toBe(2);
    expect(loaded.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
  });

  it("does not overwrite a save from a newer schema", () => {
    const store = memoryStore({
      [CAMPAIGN_STORAGE_KEY]: JSON.stringify({
        version: CAMPAIGN_SAVE_VERSION + 1,
        clearedStage: 9,
        mapTowers: {},
      }),
    });
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("newer");
    expect(loaded.saveVersion).toBe(CAMPAIGN_SAVE_VERSION + 1);
    expect(loaded.progress).toEqual(createCampaign());
    expect(persistCampaign(store, { clearedStage: 1, mapTowers: {}, mapRecaptureAt: {}, bestiaryUnlocked: [], warnedBehaviors: [], researchPoints: 0, researchBuffs: [] })).toBe(false);
    expect(JSON.parse(store.data[CAMPAIGN_STORAGE_KEY]!).clearedStage).toBe(9);
  });

  it("copies a legacy maze-td key onto the route-dilemma key", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "wall", 0);
    const legacy = serializeCampaign(
      saveMapTowers({ clearedStage: 3, mapTowers: {}, mapRecaptureAt: {}, bestiaryUnlocked: [], warnedBehaviors: [], researchPoints: 0, researchBuffs: [] }, 1, plains.towers),
    );
    const store = memoryStore({
      [LEGACY_CAMPAIGN_STORAGE_KEYS[0]]: legacy,
    });
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("migrated");
    expect(loaded.progress.clearedStage).toBe(3);
    expect(loaded.progress.mapTowers[1]).toEqual(plains.towers);
    expect(store.data[CAMPAIGN_STORAGE_KEY]).toEqual(serializeCampaign(loaded.progress));
    expect(store.data[LEGACY_CAMPAIGN_STORAGE_KEYS[0]]).toBeUndefined();
  });

  it("migrates schema 1 saves and keeps recapture locks", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "wall", 0);
    const v1 = JSON.stringify({
      version: 1,
      clearedStage: 2,
      mapTowers: { 1: plains.towers },
    });
    const loaded = parseCampaignSave(v1);
    expect(loaded.status).toBe("migrated");
    expect(loaded.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
    expect(loaded.progress.clearedStage).toBe(2);
    expect(loaded.progress.mapTowers[1]).toEqual(plains.towers);
    expect(loaded.progress.mapRecaptureAt).toEqual({});
    expect(loaded.progress.bestiaryUnlocked).toEqual([]);
    expect(loaded.progress.researchPoints).toBe(0);
    expect(loaded.progress.researchBuffs).toEqual([]);
    expect(loaded.progress.warnedBehaviors).toEqual([]);
  });

  it("round-trips defeat tower damage and recapture time", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "archer", 0);
    const damaged = [{ ...plains.towers[0]!, hp: plains.towers[0]!.hp * 0.2 }];
    const progress = {
      ...saveMapTowers(createCampaign(), 1, damaged),
      mapRecaptureAt: { 1: 1_700_000_000_000 },
    };
    const store = memoryStore();
    expect(persistCampaign(store, progress)).toBe(true);
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("ok");
    expect(loaded.progress.mapTowers[1]).toEqual(damaged);
    expect(loaded.progress.mapRecaptureAt[1]).toBe(1_700_000_000_000);
  });

  it("migrates schema 2 saves with an empty bestiary", () => {
    const v2 = JSON.stringify({
      version: 2,
      clearedStage: 1,
      mapTowers: {},
      mapRecaptureAt: {},
    });
    const loaded = parseCampaignSave(v2);
    expect(loaded.status).toBe("migrated");
    expect(loaded.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
    expect(loaded.progress.bestiaryUnlocked).toEqual([]);
    expect(loaded.progress.researchPoints).toBe(0);
    expect(loaded.progress.researchBuffs).toEqual([]);
    expect(loaded.progress.warnedBehaviors).toEqual([]);
  });

  it("round-trips bestiary unlock ids", () => {
    const progress = { ...createCampaign(), bestiaryUnlocked: ["slime-10", "wisp-16"] };
    const store = memoryStore();
    expect(persistCampaign(store, progress)).toBe(true);
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("ok");
    expect(loaded.progress.bestiaryUnlocked).toEqual(["slime-10", "wisp-16"]);
    expect(loaded.progress.clearedStage).toBe(0);
  });

  it("migrates schema 3 saves with empty research", () => {
    const v3 = JSON.stringify({
      version: 3,
      clearedStage: 2,
      mapTowers: {},
      mapRecaptureAt: {},
      bestiaryUnlocked: ["slime-10"],
    });
    const loaded = parseCampaignSave(v3);
    expect(loaded.status).toBe("migrated");
    expect(loaded.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
    expect(loaded.progress.bestiaryUnlocked).toEqual(["slime-10"]);
    expect(loaded.progress.researchPoints).toBe(0);
    expect(loaded.progress.researchBuffs).toEqual([]);
    expect(loaded.progress.warnedBehaviors).toEqual([]);
  });

  it("migrates schema 4 saves with no behavior warnings", () => {
    const v4 = JSON.stringify({
      version: 4,
      clearedStage: 4,
      mapTowers: {},
      mapRecaptureAt: {},
      bestiaryUnlocked: ["slime"],
      researchPoints: 3,
      researchBuffs: ["damage"],
    });
    const loaded = parseCampaignSave(v4);
    expect(loaded.status).toBe("migrated");
    expect(loaded.progress.warnedBehaviors).toEqual([]);
    expect(loaded.progress.researchPoints).toBe(3);
    expect(loaded.progress.bestiaryUnlocked).toEqual(["slime"]);
  });

  it("round-trips behavior warnings", () => {
    const progress = { ...createCampaign(), warnedBehaviors: ["breaker", "ambush"] as const };
    const store = memoryStore();
    expect(persistCampaign(store, progress)).toBe(true);
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("ok");
    expect(loaded.progress.warnedBehaviors).toEqual(["breaker", "ambush"]);
  });

  it("round-trips research points and chosen buffs", () => {
    const progress = {
      ...createCampaign(),
      researchPoints: 7.5,
      researchBuffs: ["startGold", "damage"] as const,
    };
    const store = memoryStore();
    expect(persistCampaign(store, progress)).toBe(true);
    const loaded = loadCampaign(store);
    expect(loaded.status).toBe("ok");
    expect(loaded.progress.researchPoints).toBe(7.5);
    expect(loaded.progress.researchBuffs).toEqual(["startGold", "damage"]);
  });
});
