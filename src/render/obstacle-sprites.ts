import type { Texture } from "pixi.js";
import type { ObstacleKind } from "@/core";
import { loadLocalTexture } from "@/render/local-image";

export type ObstacleAtlas = Record<ObstacleKind, readonly Texture[]>;

const ROCK_FILES = [
  "obstacle-rock-1.png",
  "obstacle-rock-2.png",
  "obstacle-rock-3.png",
] as const;

const TREE_FILES = [
  "obstacle-tree-1.png",
  "obstacle-bush-1.png",
  "obstacle-bush-2.png",
  "obstacle-bush-3.png",
  "obstacle-bush-4.png",
  "obstacle-bush-5.png",
  "obstacle-bush-6.png",
] as const;

async function loadNamed(file: string, fallback: string, w: number, h: number): Promise<Texture> {
  return loadLocalTexture(file, fallback, w, h);
}

export async function loadObstacleFrames(): Promise<ObstacleAtlas> {
  const [rock, tree] = await Promise.all([
    Promise.all(ROCK_FILES.map((file) => loadNamed(file, "#7a7468", 37, 27))),
    Promise.all([
      loadNamed(TREE_FILES[0], "#3d7a3a", 66, 77),
      ...TREE_FILES.slice(1).map((file) => loadNamed(file, "#4a8f45", 36, 24)),
    ]),
  ]);
  return { rock, tree };
}

/** Stable variant so the same tile always shows the same sprite. */
export function obstacleVariantIndex(x: number, y: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return Math.abs(x * 13 + y * 7) % count;
}

export function obstacleTexture(
  atlas: ObstacleAtlas,
  kind: ObstacleKind,
  x: number,
  y: number,
): Texture {
  const frames = atlas[kind];
  return frames[obstacleVariantIndex(x, y, frames.length)] ?? frames[0]!;
}
