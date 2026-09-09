import type { Texture } from "pixi.js";
import { loadLocalSheet } from "@/render/local-image";

/** 1×6 waving banner sheet. */
export const START_SHEET_COLS = 6;
export const START_SHEET_ROWS = 1;
const START_FRAME_WIDTH = 32;
const START_FRAME_HEIGHT = 64;

export async function loadStartFrames(): Promise<Texture[]> {
  return loadLocalSheet(
    "start-banner.png",
    START_SHEET_COLS,
    START_SHEET_ROWS,
    "#2f6fb3",
    START_FRAME_WIDTH,
    START_FRAME_HEIGHT,
  );
}
