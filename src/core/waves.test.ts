import { describe, expect, it } from "vitest";
import { ENEMY_TYPE_IDS } from "./sim";
import { STAGE_COUNT, enemyCount, getStageWave } from "./waves";

describe("stage wave table", () => {
  it("defines 20 fixed stages in order", () => {
    expect(STAGE_COUNT).toBe(20);
    for (let id = 1; id <= 20; id += 1) {
      expect(getStageWave(id).id).toBe(id);
    }
  });

  it("clamps out-of-range ids to the table", () => {
    expect(getStageWave(0).id).toBe(1);
    expect(getStageWave(99).id).toBe(20);
  });

  it("gives later stages more and tougher enemies than stage 1", () => {
    const first = getStageWave(1);
    const last = getStageWave(20);
    expect(enemyCount(last)).toBeGreaterThan(enemyCount(first));
    const firstHp = Math.max(...first.bursts.map((burst) => burst.hp));
    const lastHp = Math.max(...last.bursts.map((burst) => burst.hp));
    expect(lastHp).toBeGreaterThan(firstHp);
    expect(last.bursts.some((burst) => burst.types.includes("cavalry"))).toBe(true);
  });

  it("uses known enemy types and keeps ally waves smaller than enemy waves", () => {
    const allowed = new Set<string>(ENEMY_TYPE_IDS);
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      const stage = getStageWave(id);
      expect(stage.bursts.length).toBeGreaterThan(0);
      expect(stage.allyCount).toBeLessThan(enemyCount(stage));
      for (const burst of stage.bursts) {
        expect(burst.count).toBeGreaterThan(0);
        expect(burst.types.length).toBeGreaterThan(0);
        expect(burst.types.every((type) => allowed.has(type))).toBe(true);
        expect(burst.hp).toBeGreaterThan(0);
      }
    }
  });
});
