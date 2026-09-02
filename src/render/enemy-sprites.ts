import type { Texture } from "pixi.js";
import { loadLocalSheet } from "@/render/local-image";

/** 1×6 sheets facing down-right. */
export const ENEMY_SHEET_COLS = 6;
export const ENEMY_SHEET_ROWS = 1;
const ENEMY_FRAME_SIZE = 48;

export type EnemySheets = {
  readonly walk: Texture[];
  readonly attack: Texture[];
};

export async function loadEnemyFrames(): Promise<EnemySheets> {
  const [walk, attack] = await Promise.all([
    loadLocalSheet(
      "enemy-walk.png",
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      "#8b3a3a",
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
    loadLocalSheet(
      "enemy-attack.png",
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      "#b4453a",
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
  ]);
  return { walk, attack };
}
