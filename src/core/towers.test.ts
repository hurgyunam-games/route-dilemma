import { describe, expect, it } from "vitest";
import {
  BUILD_DURATION_SEC,
  canUpgrade,
  isTowerComplete,
  TOWER_ATTACK_LABELS,
  TOWER_CATALOG,
  TOWER_DEFS,
  TOWER_MAX_HP,
  TOWER_MAX_LEVEL,
  TOWER_ROLE_LABELS,
  TOWER_TYPE_IDS,
  towerAttack,
  towerBuildCost,
  towerDps,
  towerFires,
  towerMaxHp,
  towerRange,
  towerRangePreview,
  towerSplashRadius,
  towerUpgradeCost,
  UPGRADE_DURATION_SEC,
  WALL_WAVE_REPAIR_MAX_HP_RATIO,
  WAVE_REPAIR_MAX_HP_RATIO,
  waveRepairAmount,
} from "./towers";

describe("tower catalog", () => {
  it("lists distinct types with different costs, stats, and attack styles", () => {
    expect(TOWER_CATALOG).toHaveLength(TOWER_TYPE_IDS.length);
    const names = new Set(TOWER_CATALOG.map((def) => def.name));
    const costs = new Set(TOWER_CATALOG.map((def) => def.cost));
    const attacks = new Set(TOWER_CATALOG.map((def) => def.attack));
    expect(names.size).toBe(TOWER_CATALOG.length);
    expect(costs.size).toBe(TOWER_CATALOG.length);
    expect(attacks.size).toBe(TOWER_CATALOG.length);
    expect(TOWER_DEFS.archer.range).not.toBe(TOWER_DEFS.cannon.range);
    expect(TOWER_DEFS.archer.dps).not.toBe(TOWER_DEFS.mage.dps);
    expect(towerAttack({ typeId: "archer", level: 1 })).toBe("single");
    expect(towerAttack({ typeId: "melee", level: 1 })).toBe("melee");
    expect(towerAttack({ typeId: "cannon", level: 1 })).toBe("splash");
    expect(towerAttack({ typeId: "mage", level: 1 })).toBe("slow");
    expect(towerAttack({ typeId: "wall", level: 1 })).toBe("none");
    expect(TOWER_ATTACK_LABELS.melee).toBe("근접");
    expect(TOWER_ATTACK_LABELS.splash).toBe("범위");
    expect(TOWER_ATTACK_LABELS.none).toBe("없음");
    expect(TOWER_ROLE_LABELS.melee).toBe("근접 공격");
    expect(TOWER_ROLE_LABELS.splash).toBe("범위 공격");
    expect(TOWER_ROLE_LABELS.single).toBe("단발 공격");
    expect(TOWER_ROLE_LABELS.splash).not.toBe(TOWER_ROLE_LABELS.single);
    expect(TOWER_ROLE_LABELS.splash).not.toBe(TOWER_ROLE_LABELS.melee);
    expect(TOWER_ROLE_LABELS.none).toBe("길 차단");
    expect(towerSplashRadius({ typeId: "cannon", level: 1 })).toBeGreaterThan(2);
    expect(towerSplashRadius({ typeId: "archer", level: 1 })).toBe(0);
    expect(towerRange({ typeId: "melee", level: 1 })).toBe(1);
    expect(towerRange({ typeId: "archer", level: 1 })).toBeGreaterThan(
      towerRange({ typeId: "melee", level: 1 }),
    );
  });

  it("keeps default archer HP as TOWER_MAX_HP", () => {
    expect(towerMaxHp({ typeId: "archer", level: 1 })).toBe(TOWER_MAX_HP);
    expect(towerRange({ typeId: "archer", level: 1 })).toBe(2);
    expect(towerDps({ typeId: "archer", level: 1 })).toBe(4);
  });

  it("tables five levels of HP, range, and damage per combat type", () => {
    expect(TOWER_MAX_LEVEL).toBe(5);
    for (const id of TOWER_TYPE_IDS) {
      const lv1 = { typeId: id, level: 1 };
      const lv5 = { typeId: id, level: 5 };
      expect(towerMaxHp(lv5)).toBeGreaterThan(towerMaxHp(lv1));
      if (id === "wall") {
        expect(towerRange(lv1)).toBe(0);
        expect(towerRange(lv5)).toBe(0);
        expect(towerDps(lv1)).toBe(0);
        expect(towerDps(lv5)).toBe(0);
        continue;
      }
      if (id === "melee") {
        expect(towerRange(lv1)).toBe(1);
        expect(towerRange(lv5)).toBe(1);
        expect(towerDps(lv5)).toBeGreaterThan(towerDps(lv1));
        continue;
      }
      expect(towerRange(lv5)).toBeGreaterThan(towerRange(lv1));
      expect(towerDps(lv5)).toBeGreaterThan(towerDps(lv1));
    }
  });

  it("makes walls cheap to place, expensive to harden, and never fire", () => {
    const wall = { typeId: "wall" as const, level: 1 };
    expect(towerBuildCost("wall")).toBe(5);
    expect(towerBuildCost("wall")).toBeLessThan(towerBuildCost("archer"));
    expect(towerUpgradeCost(wall)).toBe(15);
    expect(towerUpgradeCost(wall)).toBeGreaterThan(towerBuildCost("wall"));
    expect(towerMaxHp(wall)).toBeGreaterThan(towerMaxHp({ typeId: "archer", level: 1 }) * 1.5);
    expect(towerMaxHp(wall)).toBeGreaterThan(towerMaxHp({ typeId: "melee", level: 1 }));
    for (let level = 1; level <= TOWER_MAX_LEVEL; level += 1) {
      const wallHp = towerMaxHp({ typeId: "wall", level });
      expect(wallHp).toBeGreaterThan(towerMaxHp({ typeId: "archer", level }));
      expect(wallHp).toBeGreaterThan(towerMaxHp({ typeId: "melee", level }));
    }
    expect(towerFires(wall)).toBe(false);
    expect(towerFires({ typeId: "archer", level: 1 })).toBe(true);
    expect(canUpgrade({ ...wall, buildTimeLeft: 0 })).toBe(true);
  });

  it("makes upgrades cost gold and raise range and damage", () => {
    const lv1 = { typeId: "archer" as const, level: 1 };
    const lv2 = { typeId: "archer" as const, level: 2 };
    expect(towerUpgradeCost(lv1)).toBe(towerBuildCost("archer"));
    expect(towerRange(lv2)).toBeGreaterThan(towerRange(lv1));
    expect(towerDps(lv2)).toBeGreaterThan(towerDps(lv1));
    expect(canUpgrade({ ...lv1, buildTimeLeft: 0 })).toBe(true);
    expect(canUpgrade({ level: TOWER_MAX_LEVEL, buildTimeLeft: 0 })).toBe(false);
    expect(isTowerComplete({ buildTimeLeft: BUILD_DURATION_SEC })).toBe(false);
    expect(isTowerComplete({ buildTimeLeft: 0 })).toBe(true);
  });

  it("keeps upgrade work longer than the first build", () => {
    expect(UPGRADE_DURATION_SEC).toBeGreaterThan(BUILD_DURATION_SEC);
  });

  it("previews range only for finished attack towers", () => {
    const archer = {
      typeId: "archer" as const,
      level: 1,
      x: 3,
      y: 2,
      buildTimeLeft: 0,
    };
    expect(towerRangePreview(archer)).toEqual({
      x: 3,
      y: 2,
      range: towerRange(archer),
      shape: "circle",
    });
    expect(towerRangePreview({ ...archer, buildTimeLeft: BUILD_DURATION_SEC })).toBeNull();
    expect(
      towerRangePreview({
        typeId: "wall",
        level: 1,
        x: 4,
        y: 2,
        buildTimeLeft: 0,
      }),
    ).toBeNull();
    expect(
      towerRangePreview({
        typeId: "melee",
        level: 1,
        x: 2,
        y: 3,
        buildTimeLeft: 0,
      }),
    ).toEqual({
      x: 2,
      y: 3,
      range: 1,
      shape: "square",
    });
  });

  it("repairs walls more than attack towers at wave end", () => {
    const archer = { typeId: "archer" as const, level: 1 };
    const wall = { typeId: "wall" as const, level: 1 };
    expect(WAVE_REPAIR_MAX_HP_RATIO).toBeGreaterThan(0);
    expect(WALL_WAVE_REPAIR_MAX_HP_RATIO).toBeGreaterThan(WAVE_REPAIR_MAX_HP_RATIO);
    expect(waveRepairAmount(archer)).toBe(towerMaxHp(archer) * WAVE_REPAIR_MAX_HP_RATIO);
    expect(waveRepairAmount(wall)).toBe(towerMaxHp(wall) * WALL_WAVE_REPAIR_MAX_HP_RATIO);
    expect(waveRepairAmount(wall)).toBeGreaterThan(waveRepairAmount(archer));
    expect(waveRepairAmount({ typeId: "cannon", level: 1 })).toBeLessThan(
      waveRepairAmount(wall),
    );
  });
});
