import { TOWER_TYPE_IDS, type TowerTypeId } from "@/core";
import { localAssetUrl } from "@/render/local-image";
import { archerDeckInSprite, spriteLayout } from "@/render/sprite-layout";

const THUMB_WIDTH = 70;
const THUMB_HEIGHT = 130;
const ALPHA_MIN = 16;
const THUMB_PAD = 4;

type KeepSpec = {
  readonly file: string;
  readonly cols: number;
  readonly occupant?: { readonly file: string; readonly cols: number };
};

const PREVIEW: Record<TowerTypeId, KeepSpec> = {
  archer: {
    file: "tower-lv1.png",
    cols: 4,
    occupant: { file: "occupant-archer-idle.png", cols: 4 },
  },
  melee: {
    file: "tower-lv1.png",
    cols: 4,
    occupant: { file: "occupant-melee-idle.png", cols: 4 },
  },
  cannon: {
    file: "cannon-bases-keep.png",
    cols: 4,
    occupant: { file: "occupant-cannon-idle.png", cols: 6 },
  },
  mage: {
    file: "mage-lv1.png",
    cols: 4,
    occupant: { file: "occupant-mage-1-idle.png", cols: 4 },
  },
  wall: {
    file: "tower-lv3.png",
    cols: 6,
  },
  research: {
    file: "mage-lv1.png",
    cols: 4,
  },
};

function makeCanvas(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d") ? canvas : null;
}

function fill(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function paintPerson(
  ctx: CanvasRenderingContext2D,
  cx: number,
  feetY: number,
  tunic: string,
  skin: string,
): void {
  fill(ctx, tunic, cx - 6, feetY - 22, 12, 16);
  fill(ctx, skin, cx - 4, feetY - 30, 8, 8);
  fill(ctx, "#2a1c14", cx - 5, feetY - 32, 10, 4);
}

function paintFallback(typeId: TowerTypeId): string {
  const canvas = makeCanvas(THUMB_WIDTH, THUMB_HEIGHT);
  if (!canvas) {
    return "";
  }
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  if (typeId === "archer") {
    fill(ctx, "#6a4a30", 16, 54, 38, 68);
    fill(ctx, "#8a6a48", 20, 48, 30, 10);
    fill(ctx, "#5a3824", 12, 42, 46, 8);
    fill(ctx, "#3a2418", 30, 88, 10, 34);
    paintPerson(ctx, 35, 78, "#3a8b3a", "#e8c090");
    fill(ctx, "#d8c090", 40, 58, 16, 3);
    fill(ctx, "#d8c090", 54, 52, 3, 14);
    return canvas.toDataURL("image/png");
  }
  if (typeId === "melee") {
    fill(ctx, "#7a5a40", 14, 50, 42, 72);
    fill(ctx, "#c45a38", 24, 36, 22, 16);
    fill(ctx, "#8a3030", 32, 28, 6, 10);
    fill(ctx, "#3a2418", 28, 90, 14, 32);
    paintPerson(ctx, 35, 80, "#8a6a38", "#e8c090");
    fill(ctx, "#c0b8a8", 18, 58, 10, 14);
    fill(ctx, "#d8d0c0", 40, 54, 4, 22);
    fill(ctx, "#d8d0c0", 38, 52, 10, 4);
    return canvas.toDataURL("image/png");
  }
  if (typeId === "cannon") {
    fill(ctx, "#5a3a2a", 10, 78, 50, 44);
    fill(ctx, "#8a4a28", 16, 70, 38, 12);
    fill(ctx, "#2a1c14", 22, 94, 10, 28);
    fill(ctx, "#3a3028", 22, 58, 36, 16);
    fill(ctx, "#c45a38", 48, 62, 16, 8);
    fill(ctx, "#2a1c14", 18, 72, 8, 8);
    fill(ctx, "#2a1c14", 44, 72, 8, 8);
    return canvas.toDataURL("image/png");
  }
  if (typeId === "mage") {
    fill(ctx, "#3a3a7a", 22, 58, 26, 64);
    fill(ctx, "#5a4aaa", 18, 50, 34, 12);
    fill(ctx, "#6a4aaa", 28, 22, 14, 30);
    fill(ctx, "#8a6acc", 32, 12, 6, 14);
    fill(ctx, "#c8b0f0", 30, 8, 10, 6);
    fill(ctx, "#2a1c48", 30, 96, 10, 26);
    paintPerson(ctx, 35, 84, "#4a5aaa", "#e8c090");
    fill(ctx, "#3a3a8a", 28, 50, 14, 8);
    fill(ctx, "#d8c090", 42, 62, 3, 28);
    fill(ctx, "#88a0e8", 40, 58, 7, 6);
    return canvas.toDataURL("image/png");
  }
  if (typeId === "research") {
    fill(ctx, "#3a4a6a", 18, 58, 34, 64);
    fill(ctx, "#5a7aaa", 14, 48, 42, 14);
    fill(ctx, "#88c0c8", 26, 22, 18, 28);
    fill(ctx, "#e8d48a", 30, 14, 10, 10);
    fill(ctx, "#2a1c48", 28, 98, 14, 24);
    fill(ctx, "#c8e8e0", 32, 36, 6, 8);
    return canvas.toDataURL("image/png");
  }
  fill(ctx, "#6a7a8a", 8, 70, 54, 52);
  fill(ctx, "#8a8a78", 8, 58, 10, 16);
  fill(ctx, "#8a8a78", 24, 58, 10, 16);
  fill(ctx, "#8a8a78", 40, 58, 10, 16);
  fill(ctx, "#8a8a78", 52, 58, 10, 16);
  fill(ctx, "#4a4a40", 8, 118, 54, 8);
  return canvas.toDataURL("image/png");
}

function opaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_MIN) {
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
  if (maxX - minX + 1 < 24 || maxY - minY + 1 < 40) {
    return null;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function cropThumb(source: HTMLCanvasElement): string {
  const ctx = source.getContext("2d");
  if (!ctx) {
    return source.toDataURL("image/png");
  }
  const bounds = opaqueBounds(
    ctx.getImageData(0, 0, source.width, source.height).data,
    source.width,
    source.height,
  );
  if (!bounds) {
    return source.toDataURL("image/png");
  }
  const out = makeCanvas(bounds.w + THUMB_PAD * 2, bounds.h + THUMB_PAD * 2);
  if (!out) {
    return source.toDataURL("image/png");
  }
  const outCtx = out.getContext("2d")!;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.w,
    bounds.h,
    THUMB_PAD,
    THUMB_PAD,
    bounds.w,
    bounds.h,
  );
  return out.toDataURL("image/png");
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = url;
  });
}

function sliceFirstFrame(
  image: HTMLImageElement,
  cols: number,
): HTMLCanvasElement | null {
  const frameWidth = Math.floor(image.width / Math.max(1, cols));
  const frameHeight = image.height;
  if (frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }
  const frame = makeCanvas(frameWidth, frameHeight);
  if (!frame) {
    return null;
  }
  const ctx = frame.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
  return frame;
}

function occupantSize(keepWidth: number, typeId: TowerTypeId): number {
  const widthInTile =
    typeId === "cannon"
      ? spriteLayout.cannonWidthInTile
      : spriteLayout.occupantWidthInTile;
  return (keepWidth * widthInTile) / spriteLayout.towerWidthInTile;
}

function occupantDeckY(keepHeight: number, typeId: TowerTypeId): number {
  if (typeId === "cannon") {
    return keepHeight * (1 - spriteLayout.cannonDeckInSprite);
  }
  if (typeId === "mage") {
    return keepHeight * (1 - spriteLayout.mageDeckInSprite);
  }
  return keepHeight * (1 - archerDeckInSprite(1));
}

function occupantAnchorY(typeId: TowerTypeId): number {
  return typeId === "archer" ? spriteLayout.archerAnchorY : spriteLayout.occupantAnchorY;
}

function compositeThumb(
  keep: HTMLCanvasElement,
  occupant: HTMLCanvasElement | null,
  typeId: TowerTypeId,
): string {
  const canvas = makeCanvas(keep.width, keep.height);
  if (!canvas) {
    return keep.toDataURL("image/png");
  }
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(keep, 0, 0);
  if (occupant && typeId !== "wall" && typeId !== "research") {
    const size = occupantSize(keep.width, typeId);
    const destH = size * (occupant.height / Math.max(1, occupant.width));
    const destX = (keep.width - size) / 2;
    const destY = occupantDeckY(keep.height, typeId) - destH * occupantAnchorY(typeId);
    ctx.drawImage(occupant, destX, destY, size, destH);
  }
  return cropThumb(canvas);
}

async function loadFrame(
  file: string,
  cols: number,
): Promise<HTMLCanvasElement | null> {
  const url = localAssetUrl(file);
  if (!url) {
    return null;
  }
  try {
    const image = await loadHtmlImage(url);
    return sliceFirstFrame(image, cols);
  } catch {
    return null;
  }
}

async function towerBuildThumb(typeId: TowerTypeId): Promise<string> {
  const spec = PREVIEW[typeId];
  const keep = await loadFrame(spec.file, spec.cols);
  if (!keep) {
    return paintFallback(typeId);
  }
  const occupant = spec.occupant
    ? await loadFrame(spec.occupant.file, spec.occupant.cols)
    : null;
  return compositeThumb(keep, occupant, typeId);
}

export function towerBuildFallbackThumb(typeId: TowerTypeId): string {
  return paintFallback(typeId);
}

export async function loadTowerBuildThumbs(): Promise<Record<TowerTypeId, string>> {
  const entries = await Promise.all(
    TOWER_TYPE_IDS.map(async (typeId) => [typeId, await towerBuildThumb(typeId)] as const),
  );
  return Object.fromEntries(entries) as Record<TowerTypeId, string>;
}
