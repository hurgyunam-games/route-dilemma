import type { Texture } from "pixi.js";
import { ENEMY_TYPE_IDS, type EnemyTypeId } from "@/core";
import { loadLocalSheet, localAssetUrl } from "@/render/local-image";

/** 1×6 sheets facing left. */
export const ENEMY_SHEET_COLS = 6;
export const ENEMY_SHEET_ROWS = 1;
const ENEMY_FRAME_SIZE = 96;

export type EnemySheets = {
  readonly walk: Texture[];
  readonly attack: Texture[];
  readonly death: Texture[];
};

export type EnemyAtlas = Record<EnemyTypeId, EnemySheets>;

const ENEMY_FILES: Record<
  EnemyTypeId,
  { walk: string; attack: string; death: string; fallback: [string, string, string] }
> = {
  beast: {
    walk: "enemy-s-walk.png",
    attack: "enemy-s-attack.png",
    death: "enemy-s-death.png",
    fallback: ["#6a5a52", "#b45a28", "#3a3430"],
  },
  cavalry: {
    walk: "enemy-cavalry-walk.png",
    attack: "enemy-cavalry-attack.png",
    death: "enemy-cavalry-death.png",
    fallback: ["#8a4a28", "#c45a38", "#4a3020"],
  },
  wolf: {
    walk: "enemy-wolf-walk.png",
    attack: "enemy-wolf-attack.png",
    death: "enemy-wolf-death.png",
    fallback: ["#3a4a62", "#5a3a3a", "#2a3038"],
  },
  slime: {
    walk: "enemy-slime-walk.png",
    attack: "enemy-slime-attack.png",
    death: "enemy-slime-death.png",
    fallback: ["#5aaa4a", "#3a7a32", "#2a4a28"],
  },
  goblin: {
    walk: "enemy-goblin-walk.png",
    attack: "enemy-goblin-attack.png",
    death: "enemy-goblin-death.png",
    fallback: ["#3a8b3a", "#b4453a", "#2a4a28"],
  },
  wisp: {
    walk: "enemy-wisp-walk.png",
    attack: "enemy-wisp-attack.png",
    death: "enemy-wisp-death.png",
    fallback: ["#7aaa3a", "#c8d86a", "#2a4a28"],
  },
  wasp: {
    walk: "enemy-wasp-walk.png",
    attack: "enemy-wasp-attack.png",
    death: "enemy-wasp-death.png",
    fallback: ["#c48a28", "#e8d090", "#4a3020"],
  },
  drake: {
    walk: "enemy-drake-walk.png",
    attack: "enemy-drake-attack.png",
    death: "enemy-drake-death.png",
    fallback: ["#3a5aaa", "#6a8ad0", "#2a3048"],
  },
};

export function enemyWalkPreview(type: EnemyTypeId): {
  readonly url: string | undefined;
  readonly fallback: string;
  readonly cols: number;
} {
  const files = ENEMY_FILES[type];
  return {
    url: localAssetUrl(files.walk),
    fallback: files.fallback[0],
    cols: ENEMY_SHEET_COLS,
  };
}

const ALPHA_MIN = 16;
const THUMB_PAD_RATIO = 0.12;
const walkThumbCache = new Map<EnemyTypeId, Promise<string | undefined>>();

export function opaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMin = ALPHA_MIN,
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= alphaMin) {
        continue;
      }
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return null;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = url;
  });
}

function croppedWalkThumb(image: HTMLImageElement): string | undefined {
  const frameWidth = Math.floor(image.width / ENEMY_SHEET_COLS);
  const frameHeight = Math.floor(image.height / ENEMY_SHEET_ROWS);
  if (frameWidth <= 0 || frameHeight <= 0) {
    return undefined;
  }
  const frame = document.createElement("canvas");
  frame.width = frameWidth;
  frame.height = frameHeight;
  const frameCtx = frame.getContext("2d");
  if (!frameCtx) {
    return undefined;
  }
  frameCtx.imageSmoothingEnabled = false;
  frameCtx.drawImage(image, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
  const bounds = opaqueBounds(
    frameCtx.getImageData(0, 0, frameWidth, frameHeight).data,
    frameWidth,
    frameHeight,
  );
  if (!bounds) {
    return undefined;
  }
  const pad = Math.max(1, Math.round(Math.max(bounds.w, bounds.h) * THUMB_PAD_RATIO));
  const box = Math.max(bounds.w, bounds.h) + pad * 2;
  const out = document.createElement("canvas");
  out.width = box;
  out.height = box;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    return undefined;
  }
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(
    frame,
    bounds.x,
    bounds.y,
    bounds.w,
    bounds.h,
    Math.round((box - bounds.w) / 2),
    Math.round((box - bounds.h) / 2),
    bounds.w,
    bounds.h,
  );
  return out.toDataURL("image/png");
}

export function enemyWalkThumbUrl(type: EnemyTypeId): Promise<string | undefined> {
  const cached = walkThumbCache.get(type);
  if (cached) {
    return cached;
  }
  const url = localAssetUrl(ENEMY_FILES[type].walk);
  if (!url) {
    const empty = Promise.resolve(undefined);
    walkThumbCache.set(type, empty);
    return empty;
  }
  const pending = loadHtmlImage(url)
    .then(croppedWalkThumb)
    .catch(() => undefined);
  walkThumbCache.set(type, pending);
  return pending;
}

export async function loadEnemyWalkThumbs(): Promise<Partial<Record<EnemyTypeId, string>>> {
  const entries = await Promise.all(
    ENEMY_TYPE_IDS.map(async (type) => {
      const url = await enemyWalkThumbUrl(type);
      return url ? ([type, url] as const) : null;
    }),
  );
  return Object.fromEntries(
    entries.filter((row): row is readonly [EnemyTypeId, string] => row !== null),
  );
}

async function loadEnemyType(type: EnemyTypeId): Promise<EnemySheets> {
  const files = ENEMY_FILES[type];
  const [walk, attack, death] = await Promise.all([
    loadLocalSheet(
      files.walk,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[0],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
    loadLocalSheet(
      files.attack,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[1],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
    loadLocalSheet(
      files.death,
      ENEMY_SHEET_COLS,
      ENEMY_SHEET_ROWS,
      files.fallback[2],
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
    ),
  ]);
  return { walk, attack, death };
}

export async function loadEnemyFrames(): Promise<EnemyAtlas> {
  const entries = await Promise.all(
    ENEMY_TYPE_IDS.map(async (type) => [type, await loadEnemyType(type)] as const),
  );
  return Object.fromEntries(entries) as EnemyAtlas;
}
