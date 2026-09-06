import { describe, expect, it } from "vitest";
import { ENEMY_TYPE_IDS } from "./sim";
import { WORLD_MAP_COUNT } from "./maps";
import {
  STAGE_COUNT,
  campaignCycle,
  enemyCount,
  enemySpeedMultiplier,
  getStageWave,
  maxEnemyHp,
  previousCycleStage,
} from "./waves";

describe("stage wave table", () => {
  it("defines 20 fixed stages in order", () => {
    expect(STAGE_COUNT).toBe(20);
    for (let id = 1; id <= 20; id += 1) {
      expect(getStageWave(id).id).toBe(id);
    }
  });

  it("keeps going past the table so later loops stay harder", () => {
    expect(getStageWave(0).id).toBe(1);
    expect(getStageWave(21).id).toBe(21);
    expect(mapIdOf(21)).toBe(1);
    expect(enemyCount(getStageWave(21))).toBeGreaterThan(enemyCount(getStageWave(16)));
    expect(maxEnemyHp(getStageWave(21))).toBeGreaterThan(maxEnemyHp(getStageWave(16)));
    expect(getStageWave(21).speed).toBeGreaterThan(getStageWave(16).speed);
  });

  it("gives later stages more and tougher enemies than stage 1", () => {
    const first = getStageWave(1);
    const fifth = getStageWave(5);
    const last = getStageWave(20);
    expect(enemyCount(fifth)).toBeGreaterThan(enemyCount(first));
    expect(enemyCount(last)).toBeGreaterThan(enemyCount(first));
    expect(maxEnemyHp(fifth)).toBeGreaterThan(maxEnemyHp(first));
    expect(maxEnemyHp(last)).toBeGreaterThan(maxEnemyHp(first));
    expect(last.bursts.some((burst) => burst.types.includes("cavalry"))).toBe(true);
  });

  it("makes the next cycle of the same map clearly stronger", () => {
    for (let map = 1; map <= WORLD_MAP_COUNT; map += 1) {
      const first = getStageWave(map);
      const next = getStageWave(map + WORLD_MAP_COUNT);
      expect(previousCycleStage(next.id)).toBe(first.id);
      expect(campaignCycle(next.id)).toBe(campaignCycle(first.id) + 1);
      expect(enemyCount(next)).toBeGreaterThan(enemyCount(first));
      expect(maxEnemyHp(next)).toBeGreaterThan(maxEnemyHp(first));
      expect(next.speed).toBeGreaterThan(first.speed);
      expect(enemySpeedMultiplier(next.id)).toBeGreaterThan(enemySpeedMultiplier(first.id));
    }
  });

  it("uses known enemy types and keeps ally waves smaller than enemy waves", () => {
    const allowed = new Set<string>(ENEMY_TYPE_IDS);
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      const stage = getStageWave(id);
      expect(stage.bursts.length).toBeGreaterThan(0);
      expect(stage.allyCount).toBeLessThan(enemyCount(stage));
      expect(stage.speed).toBeGreaterThan(0);
      for (const burst of stage.bursts) {
        expect(burst.count).toBeGreaterThan(0);
        expect(burst.types.length).toBeGreaterThan(0);
        expect(burst.types.every((type) => allowed.has(type))).toBe(true);
        expect(burst.hp).toBeGreaterThan(0);
      }
    }
  });
});

function mapIdOf(stageId: number): number {
  return ((stageId - 1) % WORLD_MAP_COUNT) + 1;
}
