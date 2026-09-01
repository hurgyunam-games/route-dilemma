import { Assets, Rectangle, Texture } from "pixi.js";
import enemyAttackUrl from "@/render/assets/enemy-attack.png";
import enemyWalkUrl from "@/render/assets/enemy-walk.png";

/** 1×6 sheets facing down-right. */
export const ENEMY_SHEET_COLS = 6;
export const ENEMY_SHEET_ROWS = 1;

export type EnemySheets = {
  readonly walk: Texture[];
  readonly attack: Texture[];
};

export async function loadEnemyFrames(): Promise<EnemySheets> {
  const [walk, attack] = await Promise.all([
    loadSheetFrames(enemyWalkUrl),
    loadSheetFrames(enemyAttackUrl),
  ]);
  return { walk, attack };
}

async function loadSheetFrames(url: string): Promise<Texture[]> {
  const sheet = await Assets.load<Texture>(url);
  sheet.source.style.scaleMode = "nearest";
  const frameWidth = Math.floor(sheet.width / ENEMY_SHEET_COLS);
  const frameHeight = Math.floor(sheet.height / ENEMY_SHEET_ROWS);
  return Array.from({ length: ENEMY_SHEET_COLS }, (_, index) =>
    new Texture({
      source: sheet.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
    }),
  );
}
