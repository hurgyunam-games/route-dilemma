import type { Texture } from "pixi.js";
import { loadLocalSheet, localAssetUrl, paintTexture } from "@/render/local-image";

/** 1×6 campfire sheet. */
export const BASE_SHEET_COLS = 6;
export const BASE_SHEET_ROWS = 1;
const BASE_FRAME_SIZE = 32;

function paintBaseFrame(index: number): Texture {
  const flicker = 2 + (index % 3);
  return paintTexture(BASE_FRAME_SIZE, BASE_FRAME_SIZE, (ctx) => {
    ctx.fillStyle = "#6a6460";
    ctx.fillRect(5, 24, 8, 5);
    ctx.fillRect(19, 24, 8, 5);
    ctx.fillRect(11, 26, 10, 4);
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(8, 21, 16, 4);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(10, 20, 12, 3);
    ctx.fillStyle = "#e86a28";
    ctx.beginPath();
    ctx.moveTo(16, 20 - 7 - flicker);
    ctx.lineTo(24, 22);
    ctx.lineTo(8, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4d35e";
    ctx.beginPath();
    ctx.moveTo(16, 18 - flicker);
    ctx.lineTo(20, 22);
    ctx.lineTo(12, 22);
    ctx.closePath();
    ctx.fill();
  });
}

export async function loadBaseFrames(): Promise<Texture[]> {
  if (localAssetUrl("base-campfire.png")) {
    return loadLocalSheet(
      "base-campfire.png",
      BASE_SHEET_COLS,
      BASE_SHEET_ROWS,
      "#b45a28",
      BASE_FRAME_SIZE,
      BASE_FRAME_SIZE,
    );
  }
  return Array.from({ length: BASE_SHEET_COLS }, (_, index) => paintBaseFrame(index));
}
