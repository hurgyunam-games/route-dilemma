import type { Texture } from "pixi.js";
import { loadLocalTexture } from "@/render/local-image";

export const ARROW_FRAME_COUNT = 27;
/** Native long side of `arrow-01.png`. Every direction keeps this pixel scale. */
export const ARROW_SOURCE_LONG_PX = 14;

export async function loadArrowFrames(): Promise<Texture[]> {
  return Promise.all(
    Array.from({ length: ARROW_FRAME_COUNT }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return loadLocalTexture(`arrow-${n}.png`, "#c9a227", 8, ARROW_SOURCE_LONG_PX);
    }),
  );
}

/** One world scale for all arrow frames so cropped directions stay the same size. */
export function arrowUniformScale(
  frames: readonly Texture[],
  tileSize: number,
  lengthInTile: number,
): number {
  let ref = ARROW_SOURCE_LONG_PX;
  for (const frame of frames) {
    ref = Math.max(ref, frame.width, frame.height);
  }
  return (tileSize * lengthInTile) / ref;
}

/** Frame 1 points up; remaining frames walk clockwise. */
export function arrowFrameIndex(dx: number, dy: number, count = ARROW_FRAME_COUNT): number {
  if (dx === 0 && dy === 0) {
    return 0;
  }
  let tau = Math.atan2(dx, -dy);
  if (tau < 0) {
    tau += Math.PI * 2;
  }
  return Math.round((tau / (Math.PI * 2)) * count) % count;
}
