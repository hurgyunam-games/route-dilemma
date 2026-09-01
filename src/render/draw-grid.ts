import { Container, Graphics, Text } from "pixi.js";
import {
  fitGridToViewport,
  forEachTile,
  tileKind,
  type Grid,
  type TileKind,
} from "@/core";

const TILE_A = 0x3a4a38;
const TILE_B = 0x2e3c2c;
const START_FILL = 0x2f6fb3;
const BASE_FILL = 0xb45a28;
const TILE_BORDER = 0x161c16;
const LABEL_FILL = 0xf4f1ea;

function tileFill(x: number, y: number, kind: TileKind): number {
  if (kind === "start") {
    return START_FILL;
  }
  if (kind === "base") {
    return BASE_FILL;
  }
  return (x + y) % 2 === 0 ? TILE_A : TILE_B;
}

function placeLabel(
  label: Text,
  originX: number,
  originY: number,
  tileSize: number,
  x: number,
  y: number,
): void {
  label.anchor.set(0.5);
  label.style.fontSize = Math.max(10, Math.floor(tileSize * 0.26));
  label.position.set(
    originX + (x + 0.5) * tileSize,
    originY + (y + 0.5) * tileSize,
  );
}

export function createGridView(): {
  readonly container: Container;
  sync(grid: Grid, viewportWidth: number, viewportHeight: number): void;
} {
  const container = new Container();
  const graphics = new Graphics();
  const startLabel = new Text({
    text: "Start",
    style: {
      fontFamily: "Segoe UI, sans-serif",
      fontWeight: "700",
      fill: LABEL_FILL,
      align: "center",
    },
  });
  const baseLabel = new Text({
    text: "Base",
    style: {
      fontFamily: "Segoe UI, sans-serif",
      fontWeight: "700",
      fill: LABEL_FILL,
      align: "center",
    },
  });
  container.addChild(graphics, startLabel, baseLabel);

  const sync = (
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
  ): void => {
    graphics.clear();
    const layout = fitGridToViewport(grid, viewportWidth, viewportHeight);
    if (layout.tileSize <= 0) {
      startLabel.visible = false;
      baseLabel.visible = false;
      return;
    }
    startLabel.visible = true;
    baseLabel.visible = true;

    forEachTile(grid, (x, y) => {
      const px = layout.originX + x * layout.tileSize;
      const py = layout.originY + y * layout.tileSize;
      graphics
        .rect(px, py, layout.tileSize, layout.tileSize)
        .fill(tileFill(x, y, tileKind(grid, x, y)))
        .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });
    });

    placeLabel(
      startLabel,
      layout.originX,
      layout.originY,
      layout.tileSize,
      grid.start.x,
      grid.start.y,
    );
    placeLabel(
      baseLabel,
      layout.originX,
      layout.originY,
      layout.tileSize,
      grid.base.x,
      grid.base.y,
    );
  };

  return { container, sync };
}
