import type { Texture } from "pixi.js";
import { loadLocalSheet } from "@/render/local-image";

/** 1×6 sheet facing down-right; flipped in the grid view like enemies. */
export const ALLY_SHEET_COLS = 6;
export const ALLY_SHEET_ROWS = 1;
const ALLY_FRAME_SIZE = 48;

export async function loadAllyFrames(): Promise<Texture[]> {
  return loadLocalSheet(
    "ally-walk.png",
    ALLY_SHEET_COLS,
    ALLY_SHEET_ROWS,
    "#3a6b4a",
    ALLY_FRAME_SIZE,
    ALLY_FRAME_SIZE,
  );
}
