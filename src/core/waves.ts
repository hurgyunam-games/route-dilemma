import waveTable from "./waves.json";
import { WORLD_MAP_COUNT } from "./maps";

export const ENEMY_TYPE_IDS = ["beast", "cavalry", "wolf", "slime", "goblin"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];

export const LOOP_SPEED_PER_CYCLE = 0.2;
export const LOOP_HP_PER_CYCLE = 0.22;
export const LOOP_COUNT_PER_BURST = 2;

export type WaveBurst = {
  readonly count: number;
  readonly interval: number;
  readonly restAfter: number;
  readonly types: readonly EnemyTypeId[];
  readonly hp: number;
};

export type StageWave = {
  readonly id: number;
  readonly enemyPhaseSec: number;
  readonly allyPhaseSec: number;
  readonly allyCount: number;
  readonly allyInterval: number;
  readonly speed: number;
  readonly bursts: readonly WaveBurst[];
};

type StageWaveRow = Omit<StageWave, "speed">;

export const STAGE_COUNT = waveTable.stages.length;

export function campaignCycle(stageId: number): number {
  return Math.floor((Math.max(1, Math.round(stageId)) - 1) / WORLD_MAP_COUNT);
}

export function previousCycleStage(stageId: number): number | null {
  const prev = Math.max(1, Math.round(stageId)) - WORLD_MAP_COUNT;
  return prev >= 1 ? prev : null;
}

export function enemySpeedMultiplier(stageId: number): number {
  return 1 + campaignCycle(stageId) * LOOP_SPEED_PER_CYCLE;
}

function templateRow(stageId: number): StageWaveRow {
  const stage = Math.max(1, Math.round(stageId));
  if (stage <= STAGE_COUNT) {
    const row = waveTable.stages[stage - 1];
    if (!row) {
      throw new Error(`Missing stage wave ${stageId}`);
    }
    return row as StageWaveRow;
  }
  const slot = (stage - 1) % WORLD_MAP_COUNT;
  const lastCycleStart = STAGE_COUNT - WORLD_MAP_COUNT + 1;
  const row = waveTable.stages[lastCycleStart - 1 + slot];
  if (!row) {
    throw new Error(`Missing stage wave ${stageId}`);
  }
  return row as StageWaveRow;
}

function withLoopPressure(row: StageWaveRow, stageId: number): StageWave {
  const extraCycles = Math.max(0, campaignCycle(stageId) - campaignCycle(STAGE_COUNT));
  const hpMul = 1 + extraCycles * LOOP_HP_PER_CYCLE;
  const countAdd = extraCycles * LOOP_COUNT_PER_BURST;
  return {
    ...row,
    id: Math.max(1, Math.round(stageId)),
    speed: enemySpeedMultiplier(stageId),
    bursts: row.bursts.map((burst) => ({
      ...burst,
      hp: Math.max(1, Math.round(burst.hp * hpMul)),
      count: burst.count + countAdd,
    })),
  };
}

export function getStageWave(stageId: number): StageWave {
  return withLoopPressure(templateRow(stageId), Math.max(1, Math.round(stageId)));
}

export function phaseDuration(stage: StageWave, phase: "enemy" | "ally"): number {
  return phase === "enemy" ? stage.enemyPhaseSec : stage.allyPhaseSec;
}

export function enemyCount(stage: StageWave): number {
  return stage.bursts.reduce((sum, burst) => sum + burst.count, 0);
}

export function maxEnemyHp(stage: StageWave): number {
  return Math.max(...stage.bursts.map((burst) => burst.hp));
}
