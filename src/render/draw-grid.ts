import { AnimatedSprite, Container, Graphics, Text, type Texture } from "pixi.js";
import {
  fitGridToViewport,
  forEachTile,
  tileKind,
  viewportToTile,
  type Grid,
  type GridLayout,
  type TileCoord,
  type TileKind,
} from "@/core";

const TILE_A = 0x3a4a38;
const TILE_B = 0x2e3c2c;
const START_FILL = 0x2f6fb3;
const BASE_FILL = 0xb45a28;
const TILE_BORDER = 0x161c16;
const LABEL_FILL = 0xf4f1ea;
const TOWER_ANIMATION_SPEED = 0.08;
const TOWER_WIDTH_IN_TILE = 1.05;

function tileFill(x: number, y: number, kind: TileKind): number {
  if (kind === "start") {
    return START_FILL;
  }
  if (kind === "base") {
    return BASE_FILL;
  }
  return (x + y) % 2 === 0 ? TILE_A : TILE_B;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
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

function layoutTowerSprite(
  sprite: AnimatedSprite,
  layout: GridLayout,
  x: number,
  y: number,
): void {
  const scale = (layout.tileSize * TOWER_WIDTH_IN_TILE) / sprite.texture.width;
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY + (y + 1) * layout.tileSize - layout.tileSize * 0.06,
  );
  sprite.zIndex = y;
}

export function createGridView(towerFrames: Texture[]): {
  readonly container: Container;
  sync(grid: Grid, viewportWidth: number, viewportHeight: number): void;
  tileAt(px: number, py: number): TileCoord | null;
} {
  const container = new Container();
  const graphics = new Graphics();
  const towerLayer = new Container();
  towerLayer.sortableChildren = true;
  const towers = new Map<string, AnimatedSprite>();
  let lastLayout: GridLayout | null = null;
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
  container.addChild(graphics, towerLayer, startLabel, baseLabel);

  const hideTowers = (): void => {
    for (const sprite of towers.values()) {
      sprite.visible = false;
    }
  };

  const sync = (
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
  ): void => {
    graphics.clear();
    const layout = fitGridToViewport(grid, viewportWidth, viewportHeight);
    lastLayout = layout;
    if (layout.tileSize <= 0) {
      startLabel.visible = false;
      baseLabel.visible = false;
      hideTowers();
      return;
    }
    startLabel.visible = true;
    baseLabel.visible = true;

    const liveTowers = new Set<string>();
    forEachTile(grid, (x, y) => {
      const px = layout.originX + x * layout.tileSize;
      const py = layout.originY + y * layout.tileSize;
      const kind = tileKind(grid, x, y);
      graphics
        .rect(px, py, layout.tileSize, layout.tileSize)
        .fill(tileFill(x, y, kind))
        .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });

      if (kind !== "tower") {
        return;
      }
      const key = tileKey(x, y);
      liveTowers.add(key);
      let sprite = towers.get(key);
      if (!sprite) {
        sprite = new AnimatedSprite({
          textures: towerFrames,
          animationSpeed: TOWER_ANIMATION_SPEED,
          loop: true,
          autoPlay: true,
        });
        sprite.anchor.set(0.5, 1);
        sprite.eventMode = "none";
        towerLayer.addChild(sprite);
        towers.set(key, sprite);
      }
      sprite.visible = true;
      layoutTowerSprite(sprite, layout, x, y);
    });

    for (const [key, sprite] of towers) {
      if (!liveTowers.has(key)) {
        sprite.destroy();
        towers.delete(key);
      }
    }

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

  const tileAt = (px: number, py: number): TileCoord | null => {
    if (!lastLayout) {
      return null;
    }
    return viewportToTile(lastLayout, px, py);
  };

  return { container, sync, tileAt };
}
