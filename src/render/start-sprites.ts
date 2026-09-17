import type { Texture } from "pixi.js";
import { loadLocalSheet, localAssetUrl, paintTexture } from "@/render/local-image";

/** 1×6 waving banner sheet. */
export const START_SHEET_COLS = 6;
export const START_SHEET_ROWS = 1;
const START_FRAME_WIDTH = 32;
const START_FRAME_HEIGHT = 64;

function paintStartFrame(index: number): Texture {
  const wave = Math.round(Math.sin((index / START_SHEET_COLS) * Math.PI * 2) * 2);
  return paintTexture(START_FRAME_WIDTH, START_FRAME_HEIGHT, (ctx) => {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(7, 8, 4, 52);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(6, 58, 6, 4);
    ctx.fillStyle = "#2f6fb3";
    ctx.beginPath();
    ctx.moveTo(11, 10);
    ctx.lineTo(28 + wave, 16);
    ctx.lineTo(24 + wave, 22);
    ctx.lineTo(11, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7eb4e8";
    ctx.beginPath();
    ctx.moveTo(11, 12);
    ctx.lineTo(22 + wave, 16);
    ctx.lineTo(11, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(13, 15, 4, 4);
  });
}

export async function loadStartFrames(): Promise<Texture[]> {
  if (localAssetUrl("start-banner.png")) {
    return loadLocalSheet(
      "start-banner.png",
      START_SHEET_COLS,
      START_SHEET_ROWS,
      "#2f6fb3",
      START_FRAME_WIDTH,
      START_FRAME_HEIGHT,
    );
  }
  return Array.from({ length: START_SHEET_COLS }, (_, index) => paintStartFrame(index));
}
