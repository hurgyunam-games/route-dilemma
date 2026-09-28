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
  researchPrerequisitesMet,
  researchStartGoldBonus,
  saveResearchPoints,
  isTowerUnlocked,
  towerUnlockBuffId,
  unlockResearchBuff,
  RESEARCH_BUFFS,
  STARTER_RESEARCH_POINTS,
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
    const root = unlockResearchBuff(progress, "unlockResearch");
    expect(root.ok).toBe(true);
    if (!root.ok) {
      return;
    }
    progress = root.progress;
    const first = unlockResearchBuff(progress, "startGold");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    progress = first.progress;
    const spent = getResearchBuff("unlockResearch").cost + getResearchBuff("startGold").cost;
    expect(progress.researchPoints).toBe(20 - spent);
    expect(hasResearchBuff(progress.researchBuffs, "startGold")).toBe(true);
    expect(researchStartGoldBonus(progress.researchBuffs)).toBe(RESEARCH_START_GOLD);
    expect(researchStartGoldBonus([])).toBe(0);
    const again = unlockResearchBuff(progress, "startGold");
    expect(again.ok).toBe(false);
  });

  it("starts with only the archer and enough points to unlock the research tower", () => {
    const progress = createCampaign();
    expect(progress.researchPoints).toBe(STARTER_RESEARCH_POINTS);
    expect(isTowerUnlocked("archer", progress.researchBuffs)).toBe(true);
    for (const typeId of ["melee", "cannon", "mage", "wall", "research"] as const) {
      expect(isTowerUnlocked(typeId, progress.researchBuffs)).toBe(false);
    }
    const opened = unlockResearchBuff(progress, "unlockResearch");
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    expect(opened.progress.researchPoints).toBe(0);
    expect(isTowerUnlocked("research", opened.progress.researchBuffs)).toBe(true);
    expect(isTowerUnlocked("wall", opened.progress.researchBuffs)).toBe(false);
    const wall = unlockResearchBuff(opened.progress, "unlockWall");
    expect(wall.ok).toBe(false);
    expect(towerUnlockBuffId("archer")).toBeNull();
    expect(towerUnlockBuffId("cannon")).toBe("unlockCannon");
  });

  it("does not unlock a buff when points are short", () => {
    const result = unlockResearchBuff(saveResearchPoints(createCampaign(), 0), "unlockResearch");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("연구 포인트가 부족합니다");
    }
  });

  it("refuses a child node until every parent is researched", () => {
    const rich = saveResearchPoints(createCampaign(), 100);
    const wall = unlockResearchBuff(rich, "unlockWall");
    expect(wall.ok).toBe(false);
    if (!wall.ok) {
      expect(wall.reason).toContain("연구 타워");
    }
    expect(researchPrerequisitesMet(rich.researchBuffs, "unlockWall")).toBe(false);

    const root = unlockResearchBuff(rich, "unlockResearch");
    expect(root.ok).toBe(true);
    if (!root.ok) {
      return;
    }
    const openedWall = unlockResearchBuff(root.progress, "unlockWall");
    expect(openedWall.ok).toBe(true);
    if (!openedWall.ok) {
      return;
    }
    const mage = unlockResearchBuff(openedWall.progress, "unlockMage");
    expect(mage.ok).toBe(false);
    if (!mage.ok) {
      expect(mage.reason).toContain("기사");
      expect(mage.reason).toContain("대포");
    }

    let progress = openedWall.progress;
    const melee = unlockResearchBuff(progress, "unlockMelee");
    expect(melee.ok).toBe(true);
    if (!melee.ok) {
      return;
    }
    progress = melee.progress;
    const cannon = unlockResearchBuff(progress, "unlockCannon");
    expect(cannon.ok).toBe(true);
    if (!cannon.ok) {
      return;
    }
    const openedMage = unlockResearchBuff(cannon.progress, "unlockMage");
    expect(openedMage.ok).toBe(true);
  });

  it("keeps a single root and rejects a cycle", () => {
    const roots = RESEARCH_BUFFS.filter((buff) => (buff.requires ?? []).length === 0);
    expect(roots.map((buff) => buff.id)).toEqual(["unlockResearch"]);
    const visiting = new Set<(typeof RESEARCH_BUFFS)[number]["id"]>();
    const visit = (id: (typeof RESEARCH_BUFFS)[number]["id"]): void => {
      expect(visiting.has(id)).toBe(false);
      visiting.add(id);
      for (const parent of getResearchBuff(id).requires ?? []) {
        visit(parent);
      }
      visiting.delete(id);
    };
    for (const buff of RESEARCH_BUFFS) {
      visit(buff.id);
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
