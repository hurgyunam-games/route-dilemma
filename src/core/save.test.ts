import { describe, expect, it } from "vitest";
import { createCampaign, saveMapTowers } from "./campaign";
import { placeTower } from "./grid";
import { createMapGrid } from "./maps";
import {
  CAMPAIGN_STORAGE_KEY,
  loadCampaign,
  parseCampaign,
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
    persistCampaign(store, progress);
    expect(store.data[CAMPAIGN_STORAGE_KEY]).toEqual(serializeCampaign(progress));
    const loaded = loadCampaign(store);
    expect(loaded.clearedStage).toBe(5);
    expect(loaded.mapTowers[1]).toEqual(plains.towers);
    expect(parseCampaign(null)).toEqual(createCampaign());
    expect(parseCampaign("not-json")).toEqual(createCampaign());
  });
});
