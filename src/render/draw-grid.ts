import {
  AnimatedSprite,
  Container,
  Graphics,
  Text,
  TilingSprite,
  type Texture,
} from "pixi.js";
import {
  findPath,
  fitGridToViewport,
  forEachTile,
  getTower,
  tileKind,
  TOWER_MAX_HP,
  viewportToTile,
  type Grid,
  type GridLayout,
  type Path,
  type TileCoord,
  type TileKind,
  type Unit,
} from "@/core";

const START_FILL = 0x2f6fb3;
const BASE_FILL = 0xb45a28;
const TILE_BORDER = 0x161c16;
const LABEL_FILL = 0xf4f1ea;
const PATH_FILL = 0xc9a227;
const PATH_LINE = 0xf4d35e;
const UNIT_FILL = 0x7ad0ff;
const UNIT_STROKE = 0x163040;
const TOWER_ANIMATION_SPEED = 0.08;
const TOWER_WIDTH_IN_TILE = 1.05;

function markerFill(kind: TileKind): number | null {
  if (kind === "start") {
    return START_FILL;
  }
  if (kind === "base") {
    return BASE_FILL;
  }
  return null;
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

function tileCenter(layout: GridLayout, x: number, y: number): { x: number; y: number } {
  return {
    x: layout.originX + (x + 0.5) * layout.tileSize,
    y: layout.originY + (y + 0.5) * layout.tileSize,
  };
}

function drawPath(graphics: Graphics, layout: GridLayout, path: Path): void {
  if (path.length === 0) {
    return;
  }
  const inset = Math.max(2, Math.floor(layout.tileSize * 0.18));
  const size = layout.tileSize - inset * 2;
  for (const tile of path) {
    graphics
      .rect(
        layout.originX + tile.x * layout.tileSize + inset,
        layout.originY + tile.y * layout.tileSize + inset,
        size,
        size,
      )
      .fill({ color: PATH_FILL, alpha: 0.45 });
  }
  const start = tileCenter(layout, path[0]!.x, path[0]!.y);
  graphics.moveTo(start.x, start.y);
  for (let i = 1; i < path.length; i += 1) {
    const point = tileCenter(layout, path[i]!.x, path[i]!.y);
    graphics.lineTo(point.x, point.y);
  }
  graphics.stroke({
    width: Math.max(3, layout.tileSize * 0.18),
    color: PATH_LINE,
    alpha: 0.95,
    cap: "round",
    join: "round",
  });
}

function drawUnits(graphics: Graphics, layout: GridLayout, units: readonly Unit[]): void {
  const radius = Math.max(4, layout.tileSize * 0.28);
  for (const unit of units) {
    const x = layout.originX + (unit.x + 0.5) * layout.tileSize;
    const y = layout.originY + (unit.y + 0.5) * layout.tileSize;
    graphics.circle(x, y, radius).fill({ color: UNIT_FILL }).stroke({
      width: Math.max(2, layout.tileSize * 0.04),
      color: UNIT_STROKE,
    });
  }
}

function hpFill(ratio: number): number {
  if (ratio > 0.5) {
    return 0x5aae61;
  }
  if (ratio > 0.25) {
    return 0xd4a017;
  }
  return 0xc4452d;
}

function drawTowerHp(
  graphics: Graphics,
  layout: GridLayout,
  x: number,
  y: number,
  hp: number,
): void {
  const width = layout.tileSize * 0.7;
  const height = Math.max(4, Math.round(layout.tileSize * 0.1));
  const left = layout.originX + (x + 0.5) * layout.tileSize - width / 2;
  const top = layout.originY + y * layout.tileSize + Math.max(3, layout.tileSize * 0.05);
  const ratio = Math.max(0, Math.min(1, hp / TOWER_MAX_HP));
  graphics.rect(left, top, width, height).fill({ color: 0x1a1412, alpha: 0.9 });
  if (ratio > 0) {
    graphics.rect(left, top, width * ratio, height).fill({ color: hpFill(ratio) });
  }
  graphics.rect(left, top, width, height).stroke({
    width: 1,
    color: 0xf4f1ea,
    alpha: 0.85,
  });
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

function layoutFloor(
  floor: TilingSprite,
  texture: Texture,
  layout: GridLayout,
): void {
  floor.visible = true;
  floor.position.set(layout.originX, layout.originY);
  floor.width = layout.width;
  floor.height = layout.height;
  floor.tileScale.set(
    layout.tileSize / texture.width,
    layout.tileSize / texture.height,
  );
}

export function createGridView(towerFrames: Texture[], floorTexture: Texture): {
  readonly container: Container;
  sync(
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
    units?: readonly Unit[],
  ): void;
  tileAt(px: number, py: number): TileCoord | null;
} {
  const container = new Container();
  const floor = new TilingSprite({
    texture: floorTexture,
    width: 1,
    height: 1,
  });
  floor.eventMode = "none";
  const graphics = new Graphics();
  const pathGraphics = new Graphics();
  const towerLayer = new Container();
  towerLayer.sortableChildren = true;
  const hpGraphics = new Graphics();
  hpGraphics.eventMode = "none";
  const unitGraphics = new Graphics();
  unitGraphics.eventMode = "none";
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
  container.addChild(
    floor,
    graphics,
    pathGraphics,
    towerLayer,
    hpGraphics,
    startLabel,
    baseLabel,
    unitGraphics,
  );

  const hideTowers = (): void => {
    for (const sprite of towers.values()) {
      sprite.visible = false;
    }
  };

  const sync = (
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
    units: readonly Unit[] = [],
  ): void => {
    graphics.clear();
    pathGraphics.clear();
    hpGraphics.clear();
    unitGraphics.clear();
    const layout = fitGridToViewport(grid, viewportWidth, viewportHeight);
    lastLayout = layout;
    if (layout.tileSize <= 0) {
      floor.visible = false;
      startLabel.visible = false;
      baseLabel.visible = false;
      hideTowers();
      return;
    }
    layoutFloor(floor, floorTexture, layout);
    startLabel.visible = true;
    baseLabel.visible = true;

    const liveTowers = new Set<string>();
    forEachTile(grid, (x, y) => {
      const px = layout.originX + x * layout.tileSize;
      const py = layout.originY + y * layout.tileSize;
      const kind = tileKind(grid, x, y);
      const fill = markerFill(kind);
      if (fill !== null) {
        graphics
          .rect(px, py, layout.tileSize, layout.tileSize)
          .fill({ color: fill, alpha: 0.55 })
          .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });
      } else {
        graphics
          .rect(px, py, layout.tileSize, layout.tileSize)
          .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });
      }

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
      const tower = getTower(grid, x, y);
      if (tower) {
        drawTowerHp(hpGraphics, layout, x, y, tower.hp);
      }
    });

    const path = findPath(grid);
    if (path) {
      drawPath(pathGraphics, layout, path);
    }
    drawUnits(unitGraphics, layout, units);

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
