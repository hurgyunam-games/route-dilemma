import { Assets, Rectangle, Texture } from "pixi.js";

const localImageUrls = import.meta.glob("./assets/*.{png,jpg,jpeg,webp,gif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function localImageUrl(fileName: string): string | undefined {
  return localImageUrls[`./assets/${fileName}`];
}

function placeholderCanvas(
  color: string,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

function placeholderTexture(color: string, width: number, height: number): Texture {
  const texture = Texture.from(placeholderCanvas(color, width, height));
  texture.source.style.scaleMode = "nearest";
  return texture;
}

export function paintTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    paint(ctx);
  }
  const texture = Texture.from(canvas);
  texture.source.style.scaleMode = "nearest";
  return texture;
}

async function textureFromUrl(url: string): Promise<Texture> {
  const texture = await Assets.load<Texture>(url);
  texture.source.style.scaleMode = "nearest";
  return texture;
}

export async function loadLocalTexture(
  fileName: string,
  fallbackColor: string,
  width: number,
  height: number,
): Promise<Texture> {
  const url = localImageUrl(fileName);
  if (!url) {
    return placeholderTexture(fallbackColor, width, height);
  }
  return textureFromUrl(url);
}

export async function loadLocalSheet(
  fileName: string,
  cols: number,
  rows: number,
  fallbackColor: string,
  frameWidth: number,
  frameHeight: number,
): Promise<Texture[]> {
  const url = localImageUrl(fileName);
  if (!url) {
    const count = cols * rows;
    return Array.from({ length: count }, () =>
      placeholderTexture(fallbackColor, frameWidth, frameHeight),
    );
  }
  const sheet = await textureFromUrl(url);
  const cellWidth = Math.floor(sheet.width / cols);
  const cellHeight = Math.floor(sheet.height / rows);
  const frames: Texture[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      frames.push(
        new Texture({
          source: sheet.source,
          frame: new Rectangle(
            col * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
          ),
        }),
      );
    }
  }
  return frames;
}
