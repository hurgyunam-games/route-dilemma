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
  TOWER_TYPE_IDS,
  towerAttack,
  towerBuildCost,
  towerDps,
  towerMaxHp,
  towerRange,
  towerUpgradeCost,
  UPGRADE_DURATION_SEC,
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
    expect(towerAttack({ typeId: "cannon", level: 1 })).toBe("splash");
    expect(towerAttack({ typeId: "mage", level: 1 })).toBe("slow");
    expect(TOWER_ATTACK_LABELS.splash).toBe("범위");
  });

  it("keeps default archer HP as TOWER_MAX_HP", () => {
    expect(towerMaxHp({ typeId: "archer", level: 1 })).toBe(TOWER_MAX_HP);
    expect(towerRange({ typeId: "archer", level: 1 })).toBe(2);
    expect(towerDps({ typeId: "archer", level: 1 })).toBe(4);
  });

  it("tables five levels of HP, range, and damage per type", () => {
    expect(TOWER_MAX_LEVEL).toBe(5);
    for (const id of TOWER_TYPE_IDS) {
      const lv1 = { typeId: id, level: 1 };
      const lv5 = { typeId: id, level: 5 };
      expect(towerMaxHp(lv5)).toBeGreaterThan(towerMaxHp(lv1));
      expect(towerRange(lv5)).toBeGreaterThan(towerRange(lv1));
      expect(towerDps(lv5)).toBeGreaterThan(towerDps(lv1));
    }
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
});
