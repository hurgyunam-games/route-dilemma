import { describe, expect, it } from "vitest";
import {
  applyDefeatTowerLoss,
  campaignMapStatuses,
  canEnterMap,
  createCampaign,
  currentStage,
  DEFEAT_HP_MAX_RATIO,
  DEFEAT_HP_MIN_RATIO,
  isMapCleared,
  isMapRecapturing,
  isMapUnlocked,
  mapIdForStage,
  playableStage,
  recaptureRemainingMs,
  RECAPTURE_DURATION_MS,
  recordDefeat,
  recordVictory,
  saveMapTowers,
  startMapRecapture,
  towersForMap,
} from "./campaign";
import { WORLD_MAP_COUNT, WORLD_MAPS } from "./maps";
import { placeTower } from "./grid";
import { createMapGrid } from "./maps";
import { towerMaxHp } from "./towers";

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

function fourTowers() {
  let grid = createMapGrid(1);
  grid = placeTower(grid, 1, 1, "archer", 0);
  grid = placeTower(grid, 1, 2, "wall", 0);
  grid = placeTower(grid, 2, 2, "cannon", 0);
  grid = placeTower(grid, 3, 2, "mage", 0);
  return grid.towers;
}

describe("defeat tower loss", () => {
  it("destroys about half the towers and cuts remaining HP to 10%–30%", () => {
    const towers = fourTowers();
    const lost = applyDefeatTowerLoss(towers, () => 0.5);
    expect(lost).toHaveLength(2);
    for (const tower of lost) {
      const maxHp = towerMaxHp(tower);
      expect(tower.hp).toBeCloseTo(maxHp * 0.2);
      expect(tower.hp).toBeGreaterThanOrEqual(maxHp * DEFEAT_HP_MIN_RATIO);
      expect(tower.hp).toBeLessThanOrEqual(maxHp * DEFEAT_HP_MAX_RATIO);
    }
    expect(lost.every((tower) => towers.some((prev) => prev.x === tower.x && prev.y === tower.y))).toBe(
      true,
    );
  });

  it("leaves an empty map unchanged", () => {
    expect(applyDefeatTowerLoss([], () => 0.5)).toEqual([]);
  });

  it("keeps a single tower and only cuts its HP", () => {
    const [tower] = fourTowers();
    const lost = applyDefeatTowerLoss([tower!], () => 0);
    expect(lost).toHaveLength(1);
    expect(lost[0]!.x).toBe(tower!.x);
    expect(lost[0]!.y).toBe(tower!.y);
    expect(lost[0]!.hp).toBeCloseTo(towerMaxHp(tower!) * DEFEAT_HP_MIN_RATIO);
  });
});

describe("campaign defeat penalty", () => {
  it("locks the lost map until recapture, then keeps the damaged towers", () => {
    const plains = fourTowers();
    const canyon = placeTower(createMapGrid(2), 4, 4, "cannon", 0).towers;
    let progress = recordVictory(createCampaign(), 1);
    progress = saveMapTowers(progress, 1, plains);
    progress = saveMapTowers(progress, 2, canyon);
    const now = 1_000;
    progress = recordDefeat(progress, 1, plains, now, () => 0.5);

    expect(towersForMap(progress, 1)).toHaveLength(2);
    expect(towersForMap(progress, 2)).toEqual(canyon);
    expect(isMapRecapturing(progress, 1, now)).toBe(true);
    expect(isMapRecapturing(progress, 2, now)).toBe(false);
    expect(canEnterMap(progress, 1, now)).toBe(false);
    expect(canEnterMap(progress, 2, now)).toBe(true);
    expect(isMapUnlocked(progress, 1)).toBe(true);
    expect(canEnterMap(progress, 1, now + RECAPTURE_DURATION_MS)).toBe(true);
    expect(recaptureRemainingMs(progress, 1, now + 10_000)).toBe(
      RECAPTURE_DURATION_MS - 10_000,
    );

    const statuses = campaignMapStatuses(progress, now);
    expect(statuses[0]!.recapturing).toBe(true);
    expect(statuses[0]!.recaptureRemainingMs).toBe(RECAPTURE_DURATION_MS);
    expect(statuses[1]!.recapturing).toBe(false);
    expect(statuses[1]!.towers).toEqual(canyon);
  });

  it("only shows Game Over side effects on a map with no towers", () => {
    const progress = recordDefeat(createCampaign(), 1, [], 5_000, () => 0.5);
    expect(towersForMap(progress, 1)).toEqual([]);
    expect(progress.mapTowers).toEqual({});
    expect(isMapRecapturing(progress, 1, 5_000)).toBe(true);
    expect(canEnterMap(progress, 1, 5_000)).toBe(false);
    expect(canEnterMap(progress, 1, 5_000 + RECAPTURE_DURATION_MS)).toBe(true);
  });

  it("restarts the recapture wait from the given time", () => {
    const first = recordDefeat(createCampaign(), 1, [], 1_000, () => 0.5);
    const later = startMapRecapture(first, 1, 20_000);
    expect(isMapRecapturing(later, 1, 20_000)).toBe(true);
    expect(canEnterMap(later, 1, 20_000)).toBe(false);
    expect(canEnterMap(later, 1, 20_000 + RECAPTURE_DURATION_MS)).toBe(true);
    expect(towersForMap(later, 1)).toEqual([]);
  });
});
