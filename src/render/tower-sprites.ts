import type { Texture } from "pixi.js";
import { loadLocalSheet } from "@/render/local-image";

/** 1×6 idle sheet; all cells loop as the finished tower. */
export const TOWER_SHEET_COLS = 6;
export const TOWER_SHEET_ROWS = 1;
const TOWER_FRAME_SIZE = 48;

export async function loadTowerFrames(): Promise<Texture[]> {
  return loadLocalSheet(
    "tower.png",
    TOWER_SHEET_COLS,
    TOWER_SHEET_ROWS,
    "#6b5a4a",
    TOWER_FRAME_SIZE,
    TOWER_FRAME_SIZE,
  );
}
