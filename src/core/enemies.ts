import enemyTable from "./enemies.json";

export const ENEMY_TYPE_IDS = ["beast", "cavalry", "wolf", "slime", "goblin"] as const;
export type EnemyTypeId = (typeof ENEMY_TYPE_IDS)[number];

export const ENEMY_SPRITE_LABELS: Record<EnemyTypeId, string> = {
  beast: "비스트",
  cavalry: "기병",
  wolf: "늑대",
  slime: "슬라임",
  goblin: "고블린",
};

export const MIN_ENEMIES = 1;
export const MAX_ENEMIES = 80;

export type EnemyDef = {
  readonly id: string;
  readonly name: string;
  readonly sprite: EnemyTypeId;
  readonly hp: number;
  /** Degrees 0–359. Same sprite, different tint. */
  readonly hue: number;
};

export function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((Math.round(value) % 360) + 360) % 360;
}

export function shiftHue(hue: number, delta = 40): number {
  return normalizeHue(hue + delta);
}

export type EnemyTable = {
  readonly enemies: readonly EnemyDef[];
};

export type ParseEnemyResult =
  | { readonly ok: true; readonly table: EnemyTable }
  | { readonly ok: false; readonly reason: string };

const bundledTable = parseEnemyTable(enemyTable);
let liveTable = cloneEnemyTable(bundledTable);

export function getEnemyCatalog(): readonly EnemyDef[] {
  return liveTable.enemies;
}

export function bundledEnemyTable(): EnemyTable {
  return cloneEnemyTable(bundledTable);
}

export function getEnemyTable(): EnemyTable {
  return liveTable;
}

export function setEnemyTable(table: EnemyTable): EnemyTable {
  liveTable = parseEnemyTable(table);
  return liveTable;
}

export function resetEnemyTable(): EnemyTable {
  liveTable = cloneEnemyTable(bundledTable);
  return liveTable;
}

export function getEnemy(id: string): EnemyDef {
  const found = tryGetEnemy(id);
  if (!found) {
    throw new Error(`Unknown enemy ${id}`);
  }
  return found;
}

export function tryGetEnemy(id: string): EnemyDef | null {
  return liveTable.enemies.find((enemy) => enemy.id === id) ?? null;
}

export function findEnemyIdForStats(sprite: EnemyTypeId, hp: number): string | null {
  return liveTable.enemies.find((enemy) => enemy.sprite === sprite && enemy.hp === hp)?.id ?? null;
}

export function cloneEnemyTable(table: EnemyTable): EnemyTable {
  return {
    enemies: table.enemies.map((enemy) => ({ ...enemy })),
  };
}

export function defaultEnemy(id: string, from?: EnemyDef): EnemyDef {
  if (from) {
    return { ...from, id };
  }
  return { id, name: "슬라임 10", sprite: "slime", hp: 10, hue: 0 };
}

export function nextEnemyId(sprite: EnemyTypeId, hp: number, used: readonly string[]): string {
  const base = `${sprite}-${hp}`;
  if (!used.includes(base)) {
    return base;
  }
  let n = 2;
  while (used.includes(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

export function parseEnemyTableJson(text: string): ParseEnemyResult {
  try {
    return { ok: true, table: parseEnemyTable(JSON.parse(text) as unknown) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid enemy table",
    };
  }
}

export function parseEnemyTable(input: unknown): EnemyTable {
  if (typeof input !== "object" || input === null || !("enemies" in input)) {
    throw new Error("Expected { enemies: [...] }");
  }
  const list = (input as { enemies: unknown }).enemies;
  if (!Array.isArray(list)) {
    throw new Error("enemies must be an array");
  }
  if (list.length < MIN_ENEMIES) {
    throw new Error(`Need at least ${MIN_ENEMIES} enemy`);
  }
  if (list.length > MAX_ENEMIES) {
    throw new Error(`At most ${MAX_ENEMIES} enemies`);
  }
  const enemies = list.map((row, index) => parseEnemyDef(row, index + 1));
  const ids = new Set<string>();
  for (const enemy of enemies) {
    if (ids.has(enemy.id)) {
      throw new Error(`Duplicate enemy id ${enemy.id}`);
    }
    ids.add(enemy.id);
  }
  return { enemies };
}

export function serializeEnemyTable(table: EnemyTable = liveTable): string {
  const rows = table.enemies
    .map(
      (enemy) =>
        `    { "id": "${enemy.id}", "name": ${JSON.stringify(enemy.name)}, "sprite": "${enemy.sprite}", "hp": ${enemy.hp}, "hue": ${enemy.hue} }`,
    )
    .join(",\n");
  return `{\n  "enemies": [\n${rows}\n  ]\n}\n`;
}

function parseEnemyDef(input: unknown, index: number): EnemyDef {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Enemy ${index} must be an object`);
  }
  const row = input as Record<string, unknown>;
  const id = parseEnemyId(row.id, index);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) {
    throw new Error(`Enemy ${id} needs a name`);
  }
  return {
    id,
    name,
    sprite: parseSprite(row.sprite, id),
    hp: asPositiveInt(row.hp, `Enemy ${id} hp`),
    hue: asHue(row.hue, id),
  };
}

function parseEnemyId(value: unknown, index: number): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`Enemy ${index} id must be kebab-case ascii`);
  }
  if (value.length > 32) {
    throw new Error(`Enemy ${value} id is too long`);
  }
  return value;
}

function parseSprite(value: unknown, id: string): EnemyTypeId {
  if (typeof value === "string" && (ENEMY_TYPE_IDS as readonly string[]).includes(value)) {
    return value as EnemyTypeId;
  }
  throw new Error(`Enemy ${id} has unknown sprite ${String(value)}`);
}

function asPositiveInt(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be an integer > 0`);
  }
  return value;
}

function asHue(value: unknown, id: string): number {
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Enemy ${id} hue must be a number`);
  }
  return normalizeHue(value);
}
