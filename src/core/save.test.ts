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
    expect(persistCampaign(store, { clearedStage: 1, mapTowers: {} })).toBe(false);
    expect(JSON.parse(store.data[CAMPAIGN_STORAGE_KEY]!).clearedStage).toBe(9);
  });

  it("copies a legacy maze-td key onto the route-dilemma key", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "wall", 0);
    const legacy = serializeCampaign(saveMapTowers({ clearedStage: 3, mapTowers: {} }, 1, plains.towers));
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
});
