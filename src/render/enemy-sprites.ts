import type { Texture } from "pixi.js";
import { ENEMY_TYPE_IDS, type EnemyTypeId } from "@/core";
import { loadLocalSheet, localAssetUrl } from "@/render/local-image";

/** 1×6 sheets facing left. */
export const ENEMY_SHEET_COLS = 6;
export const ENEMY_SHEET_ROWS = 1;
const ENEMY_FRAME_SIZE = 96;

export type EnemySheets = {
  readonly walk: Texture[];
  readonly attack: Texture[];
  readonly death: Texture[];
};

export type EnemyAtlas = Record<EnemyTypeId, EnemySheets>;

const ENEMY_FILES: Record<
  EnemyTypeId,
  { walk: string; attack: string; death: string; fallback: [string, string, string] }
> = {
  beast: {
    walk: "enemy-s-walk.png",
    attack: "enemy-s-attack.png",
    death: "enemy-s-death.png",
    fallback: ["#6a5a52", "#b45a28", "#3a3430"],
  },
  cavalry: {
    walk: "enemy-cavalry-walk.png",
    attack: "enemy-cavalry-attack.png",
    death: "enemy-cavalry-death.png",
    fallback: ["#8a4a28", "#c45a38", "#4a3020"],
  },
  wolf: {
    walk: "enemy-wolf-walk.png",
    attack: "enemy-wolf-attack.png",
    death: "enemy-wolf-death.png",
    fallback: ["#3a4a62", "#5a3a3a", "#2a3038"],
  },
  slime: {
    walk: "enemy-slime-walk.png",
    attack: "enemy-slime-attack.png",
    death: "enemy-slime-death.png",
    fallback: ["#5aaa4a", "#3a7a32", "#2a4a28"],
  },
  goblin: {
    walk: "enemy-goblin-walk.png",
    attack: "enemy-goblin-attack.png",
    death: "enemy-goblin-death.png",
    fallback: ["#3a8b3a", "#b4453a", "#2a4a28"],
  },
};

export function enemyWalkPreview(type: EnemyTypeId): {
  readonly url: string | undefined;
  readonly fallback: string;
  readonly cols: number;
} {
  const files = ENEMY_FILES[type];
  return {
    url: localAssetUrl(files.walk),
    fallback: files.fallback[0],
    cols: ENEMY_SHEET_COLS,
  };
}

async function loadEnemyType(type: EnemyTypeId): Promise<EnemySheets> {
  const files = ENEMY_FILES[type];
  const [walk, attack, death] = await Promise.all([
    loadLocalSheet(
      files.walk,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[0],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
    loadLocalSheet(
      files.attack,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[1],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
    loadLocalSheet(
      files.death,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[2],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
  ]);
  return { walk, attack, death };
}

export async function loadEnemyFrames(): Promise<EnemyAtlas> {
  const entries = await Promise.all(
    ENEMY_TYPE_IDS.map(async (type) => [type, await loadEnemyType(type)] as const),
  );
  return Object.fromEntries(entries) as EnemyAtlas;
}
