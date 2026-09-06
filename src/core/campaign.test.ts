import { describe, expect, it } from "vitest";
import {
  campaignMapStatuses,
  createCampaign,
  currentStage,
  isMapCleared,
  isMapUnlocked,
  mapIdForStage,
  playableStage,
  recordVictory,
  saveMapTowers,
  towersForMap,
} from "./campaign";
import { WORLD_MAP_COUNT, WORLD_MAPS } from "./maps";
import { placeTower } from "./grid";
import { createMapGrid } from "./maps";

function clearThrough(stage: number) {
  let progress = createCampaign();
  for (let id = 1; id <= stage; id += 1) {
    progress = recordVictory(progress, id);
  }
  return progress;
}

describe("campaign stages 1–5", () => {
  it("maps stages 1–5 onto world maps 1–5 in order", () => {
    expect(WORLD_MAPS.map((map) => map.id)).toEqual([1, 2, 3, 4, 5]);
    for (let stage = 1; stage <= WORLD_MAP_COUNT; stage += 1) {
      expect(mapIdForStage(stage)).toBe(stage);
      expect(playableStage(createCampaign(), mapIdForStage(stage))).toBe(stage);
    }
    expect(() => mapIdForStage(0)).toThrow();
  });

  it("starts with only stage 1 unlocked", () => {
    const progress = createCampaign();
    expect(currentStage(progress)).toBe(1);
    const statuses = campaignMapStatuses(progress);
    expect(statuses.map((entry) => entry.unlocked)).toEqual([true, false, false, false, false]);
    expect(statuses.every((entry) => !entry.cleared)).toBe(true);
    expect(statuses[0]!.current).toBe(true);
    expect(isMapUnlocked(progress, 1)).toBe(true);
    expect(isMapUnlocked(progress, 2)).toBe(false);
    expect(isMapUnlocked(progress, 5)).toBe(false);
  });

  it("unlocks the next map only after Victory", () => {
    let progress = createCampaign();
    progress = recordVictory(progress, 1);
    expect(currentStage(progress)).toBe(2);
    expect(isMapCleared(progress, 1)).toBe(true);
    expect(isMapCleared(progress, 2)).toBe(false);
    expect(isMapUnlocked(progress, 2)).toBe(true);
    expect(isMapUnlocked(progress, 3)).toBe(false);
    expect(campaignMapStatuses(progress).map((entry) => entry.unlocked)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);

    progress = recordVictory(progress, 1);
    expect(currentStage(progress)).toBe(2);

    progress = recordVictory(progress, 3);
    expect(currentStage(progress)).toBe(2);
    expect(isMapUnlocked(progress, 3)).toBe(false);
  });
});

describe("campaign loop from stage 6", () => {
  it("unlocks stage 6 on the first map after stage 5 Victory", () => {
    const progress = clearThrough(5);
    expect(progress.clearedStage).toBe(5);
    expect(currentStage(progress)).toBe(6);
    expect(mapIdForStage(6)).toBe(1);
    expect(playableStage(progress, 1)).toBe(6);
    const statuses = campaignMapStatuses(progress);
    expect(statuses.every((entry) => entry.unlocked && entry.cleared)).toBe(true);
    expect(statuses[0]!.current).toBe(true);
    expect(statuses[0]!.stageId).toBe(6);
    expect(statuses[1]!.stageId).toBe(2);
  });

  it("maps later stages back onto the five world maps", () => {
    expect(mapIdForStage(6)).toBe(1);
    expect(mapIdForStage(7)).toBe(2);
    expect(mapIdForStage(10)).toBe(5);
    expect(mapIdForStage(11)).toBe(1);
    const afterSix = clearThrough(6);
    expect(currentStage(afterSix)).toBe(7);
    expect(mapIdForStage(7)).toBe(2);
    expect(playableStage(afterSix, 2)).toBe(7);
    expect(playableStage(afterSix, 1)).toBe(6);
    expect(campaignMapStatuses(afterSix)[1]!.current).toBe(true);
    expect(campaignMapStatuses(afterSix)[1]!.stageId).toBe(7);
  });

  it("keeps each map's towers when the loop returns", () => {
    const plains = placeTower(createMapGrid(1), 2, 3, "archer", 0);
    const canyon = placeTower(createMapGrid(2), 4, 4, "cannon", 0);
    let progress = saveMapTowers(createCampaign(), 1, plains.towers);
    progress = saveMapTowers(progress, 2, canyon.towers);
    for (let id = 1; id <= 5; id += 1) {
      progress = recordVictory(progress, id);
    }
    expect(playableStage(progress, 1)).toBe(6);
    expect(towersForMap(progress, 1)).toEqual(plains.towers);
    expect(towersForMap(progress, 2)).toEqual(canyon.towers);
    progress = recordVictory(progress, 6);
    expect(playableStage(progress, 2)).toBe(7);
    expect(currentStage(progress)).toBe(7);
    expect(towersForMap(progress, 2)).toEqual(canyon.towers);
  });
});
