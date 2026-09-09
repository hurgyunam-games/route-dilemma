import type { Texture } from "pixi.js";
import { loadLocalSheet } from "@/render/local-image";

/** 1×6 campfire sheet. */
export const BASE_SHEET_COLS = 6;
export const BASE_SHEET_ROWS = 1;
const BASE_FRAME_SIZE = 32;

export async function loadBaseFrames(): Promise<Texture[]> {
  return loadLocalSheet(
    "base-campfire.png",
    BASE_SHEET_COLS,
    BASE_SHEET_ROWS,
    "#b45a28",
    BASE_FRAME_SIZE,
    BASE_FRAME_SIZE,
  );
}
