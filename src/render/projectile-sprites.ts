import type { Texture } from "pixi.js";
import { loadLocalSheet, loadLocalTexture } from "@/render/local-image";

export const PROJECTILE_VARIANT_COUNT = 3;
export const CANNON_BOOM_COLS = 8;
export const CANNON_BOOM_ROWS = 1;
const CANNON_BOOM_FRAME = 48;

export async function loadCannonProjectileFrames(): Promise<Texture[]> {
  return Promise.all(
    Array.from({ length: PROJECTILE_VARIANT_COUNT }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return loadLocalTexture(`cannon-proj-${n}.png`, "#6c81a1", 8, 8);
    }),
  );
}

export async function loadCannonBoomFrames(): Promise<Texture[]> {
  return loadLocalSheet(
    "cannon-boom.png",
    CANNON_BOOM_COLS,
    CANNON_BOOM_ROWS,
    "#d4782a",
    CANNON_BOOM_FRAME,
    CANNON_BOOM_FRAME,
  );
}

export async function loadMageProjectileFrames(): Promise<Texture[]> {
  return Promise.all(
    Array.from({ length: PROJECTILE_VARIANT_COUNT }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return loadLocalTexture(`mage-proj-${n}.png`, "#a147ac", 5, 5);
    }),
  );
}

export const MAGE_BOOM_COLS = 10;
export const MAGE_BOOM_ROWS = 1;
const MAGE_BOOM_FRAME_W = 64;
const MAGE_BOOM_FRAME_H = 160;
/** 소스 시트의 3번째 칸은 단색 플래시라 재생에서 뺀다. */
const MAGE_BOOM_SKIP = new Set([2]);

export async function loadMageBoomFrames(): Promise<Texture[]> {
  const frames = await loadLocalSheet(
    "mage-boom.png",
    MAGE_BOOM_COLS,
    MAGE_BOOM_ROWS,
    "#c9e8ff",
    MAGE_BOOM_FRAME_W,
    MAGE_BOOM_FRAME_H,
  );
  return frames.filter((_, index) => !MAGE_BOOM_SKIP.has(index));
}

/** lv1 → first frame, lv2 → second, lv3+ → last. */
export function projectileVariantIndex(level: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return Math.min(count, Math.max(1, level)) - 1;
}
