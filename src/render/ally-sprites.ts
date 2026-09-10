import type { Texture } from "pixi.js";
import { ALLY_TYPE_IDS, DEFAULT_ALLY_TYPE, type AllyTypeId } from "@/core";
import { loadLocalSheet, localAssetUrl } from "@/render/local-image";

/** 1×6 sheet facing down-right; flipped in the grid view like enemies. */
export const ALLY_SHEET_COLS = 6;
export const ALLY_SHEET_ROWS = 1;
const ALLY_FRAME_SIZE = 48;

export type AllyAtlas = Record<AllyTypeId, Texture[]>;

const ALLY_FILES: Record<AllyTypeId, { file: string; fallback: string }> = {
  porter: { file: "ally-walk.png", fallback: "#3a6b4a" },
  courier: { file: "ally-courier-walk.png", fallback: "#4a6a8a" },
  runner: { file: "ally-runner-walk.png", fallback: "#6a4a4a" },
  merchant: { file: "ally-merchant-walk.png", fallback: "#4a5a8a" },
};

export function allyWalkPreview(type: AllyTypeId): {
  readonly url: string | undefined;
  readonly fallback: string;
  readonly cols: number;
} {
  const files = ALLY_FILES[type];
  return {
    url: localAssetUrl(files.file),
    fallback: files.fallback,
    cols: ALLY_SHEET_COLS,
  };
}

export async function loadAllyFrames(): Promise<AllyAtlas> {
  const entries = await Promise.all(
    ALLY_TYPE_IDS.map(async (type) => {
      const spec = ALLY_FILES[type];
      const frames = await loadLocalSheet(
        spec.file,
        ALLY_SHEET_COLS,
        ALLY_SHEET_ROWS,
        spec.fallback,
        ALLY_FRAME_SIZE,
        ALLY_FRAME_SIZE,
      );
      return [type, frames] as const;
    }),
  );
  return Object.fromEntries(entries) as AllyAtlas;
}

export function allyWalkTextures(
  atlas: AllyAtlas,
  type: AllyTypeId | null,
): Texture[] {
  return atlas[type ?? DEFAULT_ALLY_TYPE];
}
