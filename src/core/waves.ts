import waveTable from "./waves.json";

export const ENEMY_TYPE_IDS = ["beast", "cavalry", "wolf", "slime", "goblin"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];

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
  readonly bursts: readonly WaveBurst[];
};

export const STAGE_COUNT = waveTable.stages.length;

export function getStageWave(stageId: number): StageWave {
  const index = Math.min(STAGE_COUNT, Math.max(1, Math.round(stageId))) - 1;
  const stage = waveTable.stages[index];
  if (!stage) {
    throw new Error(`Missing stage wave ${stageId}`);
  }
  return stage as StageWave;
}

export function phaseDuration(stage: StageWave, phase: "enemy" | "ally"): number {
  return phase === "enemy" ? stage.enemyPhaseSec : stage.allyPhaseSec;
}

export function enemyCount(stage: StageWave): number {
  return stage.bursts.reduce((sum, burst) => sum + burst.count, 0);
}
