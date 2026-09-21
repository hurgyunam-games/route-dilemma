import { describe, expect, it } from "vitest";
import { createCampaign } from "./campaign";
import { placeTower } from "./grid";
import { createGrid } from "./grid";
import {
  accrueResearchPoints,
  getResearchBuff,
  hasResearchBuff,
  modifiedTowerDps,
  modifiedTowerRange,
  researchAllyGoldMul,
  researchPointRate,
  researchStartGoldBonus,
  saveResearchPoints,
  unlockResearchBuff,
  RESEARCH_BUFFS,
  RESEARCH_DAMAGE_MUL,
  RESEARCH_POINT_PER_SEC,
  RESEARCH_RANGE_ADD,
  RESEARCH_START_GOLD,
} from "./research";
import { BUILD_DURATION_SEC } from "./towers";

describe("research tree", () => {
  it("lists distinct global buffs with costs", () => {
    expect(RESEARCH_BUFFS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(RESEARCH_BUFFS.map((buff) => buff.id));
    const names = new Set(RESEARCH_BUFFS.map((buff) => buff.name));
    const costs = new Set(RESEARCH_BUFFS.map((buff) => buff.cost));
    expect(ids.size).toBe(RESEARCH_BUFFS.length);
    expect(names.size).toBe(RESEARCH_BUFFS.length);
    expect(costs.size).toBe(RESEARCH_BUFFS.length);
    expect(getResearchBuff("startGold").description).toContain("모든 맵");
  });

  it("does not make points without a finished research tower", () => {
    const empty = createGrid(12, 8);
    expect(researchPointRate(empty.towers)).toBe(0);
    expect(accrueResearchPoints(0, empty.towers, 10)).toBe(0);
    const building = placeTower(empty, 3, 2, "research", BUILD_DURATION_SEC);
    expect(researchPointRate(building.towers)).toBe(0);
    expect(accrueResearchPoints(0, building.towers, 4)).toBe(0);
    const wall = placeTower(empty, 3, 2, "wall", 0);
    expect(researchPointRate(wall.towers)).toBe(0);
  });

  it("accrues points over time from a completed research tower", () => {
    const grid = placeTower(createGrid(12, 8), 3, 2, "research", 0);
    expect(researchPointRate(grid.towers)).toBe(RESEARCH_POINT_PER_SEC);
    expect(accrueResearchPoints(0, grid.towers, 4)).toBeCloseTo(RESEARCH_POINT_PER_SEC * 4);
  });

  it("spends points to unlock a buff and keeps it across maps", () => {
    let progress = saveResearchPoints(createCampaign(), 20);
    const first = unlockResearchBuff(progress, "startGold");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    progress = first.progress;
    expect(progress.researchPoints).toBe(20 - getResearchBuff("startGold").cost);
    expect(hasResearchBuff(progress.researchBuffs, "startGold")).toBe(true);
    expect(researchStartGoldBonus(progress.researchBuffs)).toBe(RESEARCH_START_GOLD);
    expect(researchStartGoldBonus([])).toBe(0);
    const again = unlockResearchBuff(progress, "startGold");
    expect(again.ok).toBe(false);
  });

  it("does not unlock a buff when points are short", () => {
    const result = unlockResearchBuff(createCampaign(), "damage");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("연구 포인트가 부족합니다");
    }
  });

  it("applies combat buffs the same way for every map", () => {
    const buffs = ["damage", "range"] as const;
    expect(modifiedTowerDps(4, buffs)).toBeCloseTo(4 * RESEARCH_DAMAGE_MUL);
    expect(modifiedTowerRange(2, buffs)).toBeCloseTo(2 + RESEARCH_RANGE_ADD);
    expect(modifiedTowerDps(4, [])).toBe(4);
    expect(modifiedTowerRange(0, buffs)).toBe(0);
    expect(researchAllyGoldMul([])).toBe(1);
  });
});
