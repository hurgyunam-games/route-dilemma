import { afterEach, describe, expect, it } from "vitest";
import { ENEMY_TYPE_IDS } from "./sim";
import { WORLD_MAP_COUNT } from "./maps";
import { cloneEnemyTable, getEnemyCatalog, resetEnemyTable, setEnemyTable } from "./enemies";
import {
  STAGE_COUNT,
  bundledWaveTable,
  campaignCycle,
  defaultStageWave,
  cloneWaveTable,
  allySpawnDurationSec,
  enemyCount,
  enemySpawnDurationSec,
  enemySpeedMultiplier,
  getStageWave,
  PHASE_TAIL_SEC,
  tightPhaseSec,
  getWaveTable,
  insertWaveSpawn,
  maxEnemyHp,
  moveWaveSpawn,
  parseWaveTableJson,
  previousCycleStage,
  resetWaveTable,
  serializeWaveTable,
  setWaveTable,
} from "./waves";

describe("stage wave table", () => {
  afterEach(() => {
    resetWaveTable();
    resetEnemyTable();
  });

  it("resolves spawn hue from the enemy catalog", () => {
    const catalog = getEnemyCatalog();
    setEnemyTable({
      enemies: catalog.map((enemy) =>
        enemy.id === "slime-10" ? { ...enemy, hue: 77 } : enemy,
      ),
    });
    expect(getStageWave(1).bursts[0]?.units[0]?.hue).toBe(77);
  });

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
    expect(last.bursts.some((burst) => burst.units.some((spawn) => spawn.type === "cavalry"))).toBe(
      true,
    );
    expect(first.bursts[0]?.units.every((spawn) => spawn.type === "slime")).toBe(true);
    expect(first.bursts[0]?.units.every((spawn) => spawn.behavior === "normal")).toBe(true);
    expect(first.bursts[1]?.units.slice(0, 4).map((spawn) => spawn.type)).toEqual([
      "slime",
      "goblin",
      "slime",
      "cavalry",
    ]);
    expect(first.bursts[1]?.units.some((spawn) => spawn.behavior === "breaker")).toBe(true);
    expect(first.bursts[1]?.units.some((spawn) => spawn.behavior === "normal")).toBe(true);
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      expect(
        getStageWave(id).bursts.some((burst) => burst.units.some((spawn) => spawn.behavior === "breaker")),
      ).toBe(true);
    }
  });

  it("keeps only a short wait after the last enemy or ally spawns", () => {
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      const stage = getStageWave(id);
      expect(stage.enemyPhaseSec).toBe(tightPhaseSec(enemySpawnDurationSec(stage)));
      expect(stage.allyPhaseSec).toBe(tightPhaseSec(allySpawnDurationSec(stage)));
    }
    const first = getStageWave(1);
    expect(first.enemyPhaseSec - enemySpawnDurationSec(first)).toBeLessThan(20);
    expect(first.allyPhaseSec - allySpawnDurationSec(first)).toBeLessThan(12);
  });

  it("defaults a new stage to spawn duration plus a short tail", () => {
    const row = defaultStageWave(21);
    expect(row.enemyPhaseSec).toBe(tightPhaseSec(enemySpawnDurationSec(row)));
    expect(row.allyPhaseSec).toBe(tightPhaseSec(allySpawnDurationSec(row)));
    expect(row.enemyPhaseSec).toBe(PHASE_TAIL_SEC);
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
        expect(burst.units.length).toBeGreaterThan(0);
        expect(burst.units.every((spawn) => allowed.has(spawn.type))).toBe(true);
        expect(burst.units.every((spawn) => spawn.hp > 0)).toBe(true);
      }
    }
  });
});

describe("wave table edit", () => {
  afterEach(() => {
    resetWaveTable();
    resetEnemyTable();
  });

  it("round-trips the bundled table through serialize and parse", () => {
    const parsed = parseWaveTableJson(serializeWaveTable(bundledWaveTable()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.table.stages).toHaveLength(STAGE_COUNT);
    expect(parsed.table.stages[0]?.id).toBe(1);
    expect(parsed.table.stages[0]?.bursts[0]?.units[0]).toEqual({ enemyId: "slime-10" });
  });

  it("expands legacy count/types bursts into catalog enemy ids", () => {
    const parsed = parseWaveTableJson(
      JSON.stringify({
        stages: Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          enemyPhaseSec: 30,
          allyPhaseSec: 10,
          allyCount: 2,
          allyInterval: 1,
          bursts: [
            {
              count: 4,
              interval: 0.8,
              restAfter: 2,
              types: ["slime", "goblin"],
              hp: 12,
            },
          ],
        })),
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.table.stages[0]?.bursts[0]?.units).toEqual([
      { enemyId: "slime-12" },
      { enemyId: "goblin-12" },
      { enemyId: "slime-12" },
      { enemyId: "goblin-12" },
    ]);
  });

  it("reorders an explicit spawn list", () => {
    const moved = moveWaveSpawn(
      [
        {
          interval: 0.8,
          restAfter: 1,
          units: [
            { enemyId: "slime-10" },
            { enemyId: "wolf-20" },
            { enemyId: "goblin-14" },
          ],
        },
      ],
      0,
      2,
      0,
      0,
    );
    expect(moved[0]?.units.map((spawn) => spawn.enemyId)).toEqual([
      "goblin-14",
      "slime-10",
      "wolf-20",
    ]);
  });

  it("inserts a palette enemy into a burst", () => {
    const inserted = insertWaveSpawn(
      [{ interval: 0.8, restAfter: 1, units: [{ enemyId: "slime-10" }] }],
      0,
      0,
      { enemyId: "goblin-14" },
    );
    expect(inserted[0]?.units.map((spawn) => spawn.enemyId)).toEqual(["goblin-14", "slime-10"]);
  });

  it("rejects invalid json and empty bursts", () => {
    expect(parseWaveTableJson("{").ok).toBe(false);
    expect(parseWaveTableJson('{"stages":[]}').ok).toBe(false);
    const clone = cloneWaveTable(bundledWaveTable());
    const broken = {
      stages: clone.stages.map((row, index) =>
        index === 0 ? { ...row, bursts: [] } : row,
      ),
    };
    expect(parseWaveTableJson(JSON.stringify(broken)).ok).toBe(false);
  });

  it("applies an override so later getStageWave reads the edited row", () => {
    const next = cloneWaveTable(getWaveTable());
    const first = next.stages[0];
    if (!first) {
      throw new Error("missing stage 1");
    }
    setEnemyTable({
      enemies: [
        ...cloneEnemyTable({ enemies: [...getEnemyCatalog()] }).enemies,
        { id: "cavalry-99", name: "기병 99", sprite: "cavalry", hp: 99, hue: 0, behavior: "normal" },
      ],
    });
    setWaveTable({
      stages: [
        {
          ...first,
          allyCount: 9,
          bursts: [
            {
              interval: first.bursts[0]!.interval,
              restAfter: first.bursts[0]!.restAfter,
              units: [
                { enemyId: "cavalry-99" },
                { enemyId: "cavalry-99" },
                { enemyId: "cavalry-99" },
              ],
            },
          ],
        },
        ...next.stages.slice(1),
      ],
    });
    const stage = getStageWave(1);
    expect(stage.allyCount).toBe(9);
    expect(enemyCount(stage)).toBe(3);
    expect(maxEnemyHp(stage)).toBe(99);
    expect(stage.bursts[0]?.units.map((spawn) => spawn.type)).toEqual([
      "cavalry",
      "cavalry",
      "cavalry",
    ]);
  });
});

function mapIdOf(stageId: number): number {
  return ((stageId - 1) % WORLD_MAP_COUNT) + 1;
}
