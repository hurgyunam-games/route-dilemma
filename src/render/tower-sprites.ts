import { Assets, Rectangle, Texture } from "pixi.js";
import towerSheetUrl from "@/render/assets/tower.png";

/** 1×6 idle sheet; all cells loop as the finished tower. */
export const TOWER_SHEET_COLS = 6;
export const TOWER_SHEET_ROWS = 1;

export async function loadTowerFrames(): Promise<Texture[]> {
  const sheet = await Assets.load<Texture>(towerSheetUrl);
  sheet.source.style.scaleMode = "nearest";
  const frameWidth = Math.floor(sheet.width / TOWER_SHEET_COLS);
  const frameHeight = Math.floor(sheet.height / TOWER_SHEET_ROWS);
  return Array.from({ length: TOWER_SHEET_COLS }, (_, index) =>
    new Texture({
      source: sheet.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
    }),
  );
}
