import waveTable from "./waves.json";
import { WORLD_MAP_COUNT } from "./maps";
import {
  ENEMY_TYPE_IDS,
  findEnemyIdForStats,
  getEnemy,
  getEnemyCatalog,
  type EnemyTypeId,
} from "./enemies";

export { ENEMY_TYPE_IDS } from "./enemies";
export type { EnemyTypeId } from "./enemies";

export const LOOP_SPEED_PER_CYCLE = 0.2;
export const LOOP_HP_PER_CYCLE = 0.22;
export const LOOP_COUNT_PER_BURST = 2;
export const MIN_WAVE_STAGES = WORLD_MAP_COUNT;
export const MAX_WAVE_STAGES = 40;
export const MAX_WAVE_SPAWNS_PER_BURST = 80;

export type WaveSpawnRef = {
  readonly enemyId: string;
};

export type WaveSpawn = WaveSpawnRef & {
  readonly type: EnemyTypeId;
  readonly hp: number;
  readonly hue: number;
};

export type WaveBurstRow = {
  readonly interval: number;
  readonly restAfter: number;
  readonly units: readonly WaveSpawnRef[];
};

export type WaveBurst = {
  readonly interval: number;
  readonly restAfter: number;
  readonly units: readonly WaveSpawn[];
};

export type StageWaveRow = {
  readonly id: number;
  readonly enemyPhaseSec: number;
  readonly allyPhaseSec: number;
  readonly allyCount: number;
  readonly allyInterval: number;
  readonly bursts: readonly WaveBurstRow[];
};

export type StageWave = Omit<StageWaveRow, "bursts"> & {
  readonly speed: number;
  readonly bursts: readonly WaveBurst[];
};

export type WaveTable = {
  readonly stages: readonly StageWaveRow[];
};

export type ParseWaveResult =
  | { readonly ok: true; readonly table: WaveTable }
  | { readonly ok: false; readonly reason: string };

const bundledTable = parseWaveTable(waveTable);
let liveTable = cloneWaveTable(bundledTable);

export const STAGE_COUNT = bundledTable.stages.length;

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

export function waveStageCount(): number {
  return liveTable.stages.length;
}

export function getWaveTable(): WaveTable {
  return liveTable;
}

export function bundledWaveTable(): WaveTable {
  return cloneWaveTable(bundledTable);
}

export function setWaveTable(table: WaveTable): WaveTable {
  liveTable = parseWaveTable(table);
  return liveTable;
}

export function resetWaveTable(): WaveTable {
  liveTable = cloneWaveTable(bundledTable);
  return liveTable;
}

export function waveEnemyIds(table: WaveTable = liveTable): readonly string[] {
  const ids = new Set<string>();
  for (const stage of table.stages) {
    for (const burst of stage.bursts) {
      for (const spawn of burst.units) {
        ids.add(spawn.enemyId);
      }
    }
  }
  return [...ids];
}

export function defaultWaveSpawn(): WaveSpawnRef {
  const first = getEnemyCatalog()[0];
  return { enemyId: first?.id ?? "slime-10" };
}

export function defaultWaveBurst(): WaveBurstRow {
  return {
    interval: 0.8,
    restAfter: 2,
    units: [defaultWaveSpawn()],
  };
}

export function defaultStageWave(id: number, from?: StageWaveRow): StageWaveRow {
  if (from) {
    return { ...cloneRow(from), id };
  }
  return {
    id,
    enemyPhaseSec: 36,
    allyPhaseSec: 14,
    allyCount: 3,
    allyInterval: 0.9,
    bursts: [defaultWaveBurst()],
  };
}

export function cloneWaveTable(table: WaveTable): WaveTable {
  return { stages: table.stages.map(cloneRow) };
}

export function moveWaveSpawn(
  bursts: readonly WaveBurstRow[],
  fromBurst: number,
  fromIndex: number,
  toBurst: number,
  toIndex: number,
): readonly WaveBurstRow[] {
  if (fromBurst === toBurst && fromIndex === toIndex) {
    return bursts;
  }
  const next = bursts.map((burst) => ({
    ...burst,
    units: [...burst.units],
  }));
  const source = next[fromBurst];
  const dest = next[toBurst];
  if (!source || !dest) {
    return bursts;
  }
  if (fromIndex < 0 || fromIndex >= source.units.length) {
    return bursts;
  }
  if (fromBurst !== toBurst && source.units.length <= 1) {
    return bursts;
  }
  const [item] = source.units.splice(fromIndex, 1);
  if (!item) {
    return bursts;
  }
  let insertAt = Math.max(0, Math.min(toIndex, dest.units.length));
  if (fromBurst === toBurst && fromIndex < insertAt) {
    insertAt -= 1;
  }
  dest.units.splice(insertAt, 0, item);
  return next;
}

export function insertWaveSpawn(
  bursts: readonly WaveBurstRow[],
  burstIndex: number,
  index: number,
  spawn: WaveSpawnRef,
): readonly WaveBurstRow[] {
  const burst = bursts[burstIndex];
  if (!burst || burst.units.length >= MAX_WAVE_SPAWNS_PER_BURST) {
    return bursts;
  }
  const insertAt = Math.max(0, Math.min(index, burst.units.length));
  return bursts.map((row, i) =>
    i === burstIndex
      ? {
          ...row,
          units: [...row.units.slice(0, insertAt), spawn, ...row.units.slice(insertAt)],
        }
      : row,
  );
}

export function parseWaveTableJson(text: string): ParseWaveResult {
  try {
    return { ok: true, table: parseWaveTable(JSON.parse(text) as unknown) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid wave table",
    };
  }
}

export function parseWaveTable(input: unknown): WaveTable {
  if (typeof input !== "object" || input === null || !("stages" in input)) {
    throw new Error("Expected { stages: [...] }");
  }
  const stagesValue = (input as { stages: unknown }).stages;
  if (!Array.isArray(stagesValue)) {
    throw new Error("stages must be an array");
  }
  if (stagesValue.length < MIN_WAVE_STAGES) {
    throw new Error(`Need at least ${MIN_WAVE_STAGES} stages`);
  }
  if (stagesValue.length > MAX_WAVE_STAGES) {
    throw new Error(`At most ${MAX_WAVE_STAGES} stages`);
  }
  const stages = stagesValue.map((row, index) => parseStageRow(row, index + 1));
  return { stages };
}

export function serializeWaveTable(table: WaveTable = liveTable): string {
  const stages = table.stages
    .map((stage) => {
      const bursts = stage.bursts
        .map((burst) => {
          const units = burst.units
            .map((spawn) => `            { "enemyId": "${spawn.enemyId}" }`)
            .join(",\n");
          return `        {
          "interval": ${formatNum(burst.interval)},
          "restAfter": ${formatNum(burst.restAfter)},
          "units": [
${units}
          ]
        }`;
        })
        .join(",\n");
      return `    {
      "id": ${stage.id},
      "enemyPhaseSec": ${formatNum(stage.enemyPhaseSec)},
      "allyPhaseSec": ${formatNum(stage.allyPhaseSec)},
      "allyCount": ${stage.allyCount},
      "allyInterval": ${formatNum(stage.allyInterval)},
      "bursts": [
${bursts}
      ]
    }`;
    })
    .join(",\n");
  return `{\n  "stages": [\n${stages}\n  ]\n}\n`;
}

function templateRow(stageId: number): StageWaveRow {
  const stages = liveTable.stages;
  const count = stages.length;
  const stage = Math.max(1, Math.round(stageId));
  if (stage <= count) {
    const row = stages[stage - 1];
    if (!row) {
      throw new Error(`Missing stage wave ${stageId}`);
    }
    return row;
  }
  const slot = (stage - 1) % WORLD_MAP_COUNT;
  const lastCycleStart = count - WORLD_MAP_COUNT + 1;
  const row = stages[lastCycleStart - 1 + slot];
  if (!row) {
    throw new Error(`Missing stage wave ${stageId}`);
  }
  return row;
}

function withLoopPressure(row: StageWaveRow, stageId: number): StageWave {
  const extraCycles = Math.max(0, campaignCycle(stageId) - campaignCycle(liveTable.stages.length));
  const hpMul = 1 + extraCycles * LOOP_HP_PER_CYCLE;
  const countAdd = extraCycles * LOOP_COUNT_PER_BURST;
  return {
    ...row,
    id: Math.max(1, Math.round(stageId)),
    speed: enemySpeedMultiplier(stageId),
    bursts: row.bursts.map((burst) => scaleBurst(burst, hpMul, countAdd)),
  };
}

function scaleBurst(burst: WaveBurstRow, hpMul: number, countAdd: number): WaveBurst {
  const units = burst.units.map((spawn) => resolveAndScale(spawn, hpMul));
  const extra: WaveSpawn[] = [];
  if (units.length > 0) {
    for (let i = 0; i < countAdd; i += 1) {
      extra.push({ ...units[i % units.length]! });
    }
  }
  return { interval: burst.interval, restAfter: burst.restAfter, units: [...units, ...extra] };
}

function resolveAndScale(ref: WaveSpawnRef, hpMul: number): WaveSpawn {
  const def = getEnemy(ref.enemyId);
  return {
    enemyId: def.id,
    type: def.sprite,
    hp: Math.max(1, Math.round(def.hp * hpMul)),
    hue: def.hue,
  };
}

export function getStageWave(stageId: number): StageWave {
  return withLoopPressure(templateRow(stageId), Math.max(1, Math.round(stageId)));
}

export function phaseDuration(stage: StageWave, phase: "enemy" | "ally"): number {
  return phase === "enemy" ? stage.enemyPhaseSec : stage.allyPhaseSec;
}

export function enemyCount(stage: {
  readonly bursts: readonly { readonly units: readonly unknown[] }[];
}): number {
  return stage.bursts.reduce((sum, burst) => sum + burst.units.length, 0);
}

export function maxEnemyHp(stage: StageWave): number {
  return Math.max(0, ...stage.bursts.flatMap((burst) => burst.units.map((spawn) => spawn.hp)));
}

export function enemySpawnDurationSec(
  stage: Pick<StageWaveRow, "bursts"> | Pick<StageWave, "bursts">,
): number {
  return stage.bursts.reduce((sum, burst, index, all) => {
    const spawn = Math.max(0, burst.units.length - 1) * burst.interval;
    const rest = index < all.length - 1 ? burst.restAfter : 0;
    return sum + spawn + rest;
  }, 0);
}

function cloneSpawn(spawn: WaveSpawnRef): WaveSpawnRef {
  return { enemyId: spawn.enemyId };
}

function cloneBurst(burst: WaveBurstRow): WaveBurstRow {
  return {
    interval: burst.interval,
    restAfter: burst.restAfter,
    units: burst.units.map(cloneSpawn),
  };
}

function cloneRow(row: StageWaveRow): StageWaveRow {
  return {
    id: row.id,
    enemyPhaseSec: row.enemyPhaseSec,
    allyPhaseSec: row.allyPhaseSec,
    allyCount: row.allyCount,
    allyInterval: row.allyInterval,
    bursts: row.bursts.map(cloneBurst),
  };
}

function parseStageRow(input: unknown, id: number): StageWaveRow {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Stage ${id} must be an object`);
  }
  const row = input as Record<string, unknown>;
  const burstsValue = row.bursts;
  if (!Array.isArray(burstsValue) || burstsValue.length === 0) {
    throw new Error(`Stage ${id} needs at least one burst`);
  }
  return {
    id,
    enemyPhaseSec: asPositive(row.enemyPhaseSec, `Stage ${id} enemyPhaseSec`),
    allyPhaseSec: asPositive(row.allyPhaseSec, `Stage ${id} allyPhaseSec`),
    allyCount: asPositiveInt(row.allyCount, `Stage ${id} allyCount`),
    allyInterval: asPositive(row.allyInterval, `Stage ${id} allyInterval`),
    bursts: burstsValue.map((burst, index) => parseBurst(burst, id, index + 1)),
  };
}

function parseBurst(input: unknown, stageId: number, burstId: number): WaveBurstRow {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Stage ${stageId} burst ${burstId} must be an object`);
  }
  const burst = input as Record<string, unknown>;
  return {
    interval: asPositive(burst.interval, `Stage ${stageId} burst ${burstId} interval`),
    restAfter: asNonNegative(burst.restAfter, `Stage ${stageId} burst ${burstId} restAfter`),
    units: parseBurstUnits(burst, stageId, burstId),
  };
}

function parseBurstUnits(
  burst: Record<string, unknown>,
  stageId: number,
  burstId: number,
): WaveSpawnRef[] {
  if (Array.isArray(burst.units)) {
    if (burst.units.length === 0) {
      throw new Error(`Stage ${stageId} burst ${burstId} needs at least one unit`);
    }
    if (burst.units.length > MAX_WAVE_SPAWNS_PER_BURST) {
      throw new Error(`Stage ${stageId} burst ${burstId} has too many units`);
    }
    return burst.units.map((spawn, index) => parseSpawn(spawn, stageId, burstId, index + 1));
  }
  const typesValue = burst.types;
  if (!Array.isArray(typesValue) || typesValue.length === 0) {
    throw new Error(`Stage ${stageId} burst ${burstId} needs units or types`);
  }
  const types = typesValue.map((type) => parseEnemyType(type, stageId, burstId));
  const count = asPositiveInt(burst.count, `Stage ${stageId} burst ${burstId} count`);
  const hp = asPositiveInt(burst.hp, `Stage ${stageId} burst ${burstId} hp`);
  if (count > MAX_WAVE_SPAWNS_PER_BURST) {
    throw new Error(`Stage ${stageId} burst ${burstId} has too many units`);
  }
  return Array.from({ length: count }, (_, index) =>
    spawnRefFromStats(types[index % types.length] ?? "slime", hp, stageId, burstId),
  );
}

function parseSpawn(
  input: unknown,
  stageId: number,
  burstId: number,
  spawnId: number,
): WaveSpawnRef {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Stage ${stageId} burst ${burstId} unit ${spawnId} must be an object`);
  }
  const spawn = input as Record<string, unknown>;
  if (typeof spawn.enemyId === "string") {
    getEnemy(spawn.enemyId);
    return { enemyId: spawn.enemyId };
  }
  const type = parseEnemyType(spawn.type, stageId, burstId);
  const hp = asPositiveInt(spawn.hp, `Stage ${stageId} burst ${burstId} unit ${spawnId} hp`);
  return spawnRefFromStats(type, hp, stageId, burstId);
}

function spawnRefFromStats(
  type: EnemyTypeId,
  hp: number,
  stageId: number,
  burstId: number,
): WaveSpawnRef {
  const enemyId = findEnemyIdForStats(type, hp);
  if (!enemyId) {
    throw new Error(`Stage ${stageId} burst ${burstId} has no enemy ${type} hp ${hp}`);
  }
  return { enemyId };
}

function parseEnemyType(value: unknown, stageId: number, burstId: number): EnemyTypeId {
  if (typeof value === "string" && (ENEMY_TYPE_IDS as readonly string[]).includes(value)) {
    return value as EnemyTypeId;
  }
  throw new Error(`Stage ${stageId} burst ${burstId} has unknown type ${String(value)}`);
}

function asPositive(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be > 0`);
  }
  return value;
}

function asNonNegative(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be >= 0`);
  }
  return value;
}

function asPositiveInt(value: unknown, name: string): number {
  const n = asPositive(value, name);
  if (!Number.isInteger(n)) {
    throw new Error(`${name} must be an integer`);
  }
  return n;
}

function formatNum(value: number): string {
  return String(value);
}
