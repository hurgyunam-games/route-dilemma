import {
  AnimatedSprite,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TilingSprite,
  type Texture,
} from "pixi.js";
import {
  findPath,
  fitGridToViewport,
  forEachTile,
  getObstacle,
  getTower,
  isTowerComplete,
  obstacleMaxHp,
  tileKind,
  towerMaxHp,
  towerWorkDuration,
  UNIT_MAX_HP,
  viewportToTile,
  type EnemyTypeId,
  type Grid,
  type GridLayout,
  type Path,
  type TileCoord,
  type Tower,
  type TowerShot,
  type Unit,
  type UnitKind,
} from "@/core";
import type { EnemyAtlas, EnemySheets } from "@/render/enemy-sprites";
import {
  occupantClipFrames,
  occupantVariantIndex,
  type OccupantAtlas,
} from "@/render/occupant-sprites";
import { arrowFrameIndex, arrowUniformScale } from "@/render/arrow-sprites";
import {
  obstacleTexture,
  type ObstacleAtlas,
} from "@/render/obstacle-sprites";
import { projectileVariantIndex } from "@/render/projectile-sprites";
import {
  ENEMY_ANCHOR_Y,
  layoutEnemySprite,
  layoutOccupantSprite,
  layoutObstacleSprite,
  layoutStartSprite,
  layoutBaseSprite,
  layoutTowerRoofSprite,
  layoutTowerSprite,
  layoutTowerWallSprite,
  spriteLayout,
  towerRoofFromTop,
  towerWallFromTop,
} from "@/render/sprite-layout";
import {
  towerRoofTexture,
  towerVisualFrames,
  towerWallTexture,
  type TowerAtlasMap,
} from "@/render/tower-sprites";

const TILE_BORDER = 0x161c16;
const PATH_FILL = 0xc9a227;
const PATH_LINE = 0xf4d35e;
const TOWER_ANIMATION_SPEED = 0.08;
const TOWER_FIRE_ANIMATION_SPEED = 0.22;
const OCCUPANT_IDLE_SPEED = 0.1;
const OCCUPANT_ATTACK_SPEED = 0.2;
const START_ANIMATION_SPEED = 0.1;
const BASE_ANIMATION_SPEED = 0.14;
/** HP bar sits this fraction of a tile above the floor (on the dirt, under the occupant). */
const TOWER_HP_Y_IN_TILE = 0.08;
const ENEMY_ANIMATION_SPEED = 0.14;
const ENEMY_ATTACK_ANIMATION_SPEED = 0.18;
const ENEMY_DEATH_ANIMATION_SPEED = 0.16;
const UNIT_MOVE_EPS = 0.002;
const BASE_ARRIVE_EPS = 0.2;

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
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

type EnemyClip = "walk" | "attack" | "death";

type UnitSprite = {
  sprite: AnimatedSprite;
  lastX: number;
  lastY: number;
  facing: 1 | -1;
  clip: EnemyClip;
  kind: UnitKind;
  enemyType: EnemyTypeId | null;
  hue: number;
};

const hueFilterCache = new Map<number, ColorMatrixFilter>();

function applyUnitHue(sprite: AnimatedSprite, hue: number): void {
  const deg = ((Math.round(hue) % 360) + 360) % 360;
  if (deg === 0) {
    sprite.filters = null;
    return;
  }
  let filter = hueFilterCache.get(deg);
  if (!filter) {
    filter = new ColorMatrixFilter();
    filter.hue(deg, false);
    hueFilterCache.set(deg, filter);
  }
  sprite.filters = [filter];
}

function enemySheetsFor(
  enemyType: EnemyTypeId | null,
  atlas: EnemyAtlas,
): EnemySheets {
  return atlas[enemyType ?? "beast"];
}

function unitWalkTextures(
  kind: UnitKind,
  enemyType: EnemyTypeId | null,
  atlas: EnemyAtlas,
  allyWalk: Texture[],
): Texture[] {
  return kind === "ally" ? allyWalk : enemySheetsFor(enemyType, atlas).walk;
}

function unitClipTextures(
  kind: UnitKind,
  enemyType: EnemyTypeId | null,
  clip: EnemyClip,
  atlas: EnemyAtlas,
  allyWalk: Texture[],
): Texture[] {
  if (kind === "ally" || clip === "walk") {
    return unitWalkTextures(kind, enemyType, atlas, allyWalk);
  }
  const sheets = enemySheetsFor(enemyType, atlas);
  if (clip === "death") {
    return sheets.death;
  }
  return sheets.attack;
}

function horizontalFacing(dx: number, fallback: 1 | -1): 1 | -1 {
  if (dx > UNIT_MOVE_EPS) {
    return -1;
  }
  if (dx < -UNIT_MOVE_EPS) {
    return 1;
  }
  return fallback;
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

function drawHpBar(
  graphics: Graphics,
  left: number,
  top: number,
  width: number,
  height: number,
  hp: number,
  maxHp: number,
): void {
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
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

function drawTowerHp(
  graphics: Graphics,
  layout: GridLayout,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  hideWhenFull = false,
): void {
  if (hideWhenFull && hp >= maxHp) {
    return;
  }
  const width = layout.tileSize * 0.7;
  const height = Math.max(4, Math.round(layout.tileSize * 0.1));
  const left = layout.originX + (x + 0.5) * layout.tileSize - width / 2;
  const top =
    layout.originY +
    (y + 1 - TOWER_HP_Y_IN_TILE) * layout.tileSize -
    height;
  drawHpBar(graphics, left, top, width, height, hp, maxHp);
}

function drawLevelPips(
  graphics: Graphics,
  layout: GridLayout,
  x: number,
  y: number,
  level: number,
): void {
  const size = Math.max(4, Math.round(layout.tileSize * 0.1));
  const gap = Math.max(2, Math.round(layout.tileSize * 0.04));
  const total = level * size + (level - 1) * gap;
  const startX =
    layout.originX + (x + 0.5) * layout.tileSize - total / 2;
  const hpHeight = Math.max(4, Math.round(layout.tileSize * 0.1));
  const top =
    layout.originY +
    (y + 1 - TOWER_HP_Y_IN_TILE) * layout.tileSize -
    hpHeight -
    size -
    Math.max(2, Math.round(layout.tileSize * 0.03));
  for (let i = 0; i < level; i += 1) {
    graphics
      .rect(startX + i * (size + gap), top, size, size)
      .fill({ color: 0xe8b060, alpha: 0.95 });
  }
}

function drawConstruction(
  graphics: Graphics,
  layout: GridLayout,
  x: number,
  y: number,
  progress: number,
): void {
  const inset = layout.tileSize * 0.12;
  const left = layout.originX + x * layout.tileSize + inset;
  const top = layout.originY + y * layout.tileSize + inset;
  const size = layout.tileSize - inset * 2;
  graphics.rect(left, top, size, size).fill({ color: 0x3a3228, alpha: 0.22 });
  graphics.rect(left, top, size, size).stroke({
    width: Math.max(2, layout.tileSize * 0.04),
    color: 0xe8b060,
    alpha: 0.92,
  });
  const barH = Math.max(4, layout.tileSize * 0.1);
  const barY = top + size - barH - 2;
  const barW = size - 4;
  graphics.rect(left + 2, barY, barW, barH).fill({ color: 0x1a1412, alpha: 0.9 });
  graphics
    .rect(left + 2, barY, barW * Math.max(0, Math.min(1, progress)), barH)
    .fill({ color: 0xe8b060 });
}

function drawRangePreview(
  graphics: Graphics,
  layout: GridLayout,
  x: number,
  y: number,
  range: number,
): void {
  const center = tileCenter(layout, x, y);
  graphics.circle(center.x, center.y, range * layout.tileSize).stroke({
    width: Math.max(2, layout.tileSize * 0.04),
    color: 0x7ec8ff,
    alpha: 0.75,
  });
}

function drawUnitHp(
  graphics: Graphics,
  layout: GridLayout,
  unit: Unit,
  sprite: AnimatedSprite,
): void {
  const width = layout.tileSize * 0.55;
  const height = Math.max(3, Math.round(layout.tileSize * 0.08));
  const gap = Math.max(2, Math.round(layout.tileSize * 0.05));
  const left = layout.originX + (unit.x + 0.5) * layout.tileSize - width / 2;
  const headY = sprite.y - sprite.anchor.y * Math.abs(sprite.height);
  const top = headY - height - gap;
  if (unit.kind === "enemy" && unit.behavior === "breaker") {
    const mark = Math.max(4, Math.round(layout.tileSize * 0.12));
    const cx = left + width / 2;
    const cy = top - mark * 0.35;
    graphics
      .poly([cx, cy - mark * 0.55, cx + mark * 0.55, cy + mark * 0.35, cx - mark * 0.55, cy + mark * 0.35])
      .fill({ color: 0xff6b3d, alpha: 0.95 });
  }
  drawHpBar(graphics, left, top, width, height, unit.hp, UNIT_MAX_HP);
}

function shotPixel(
  layout: GridLayout,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: layout.originX + (x + 0.5) * layout.tileSize,
    y: layout.originY + (y + 0.5) * layout.tileSize,
  };
}

function layoutArrowSprite(
  sprite: Sprite,
  layout: GridLayout,
  shot: TowerShot,
  frames: Texture[],
  scale: number,
): void {
  const pos = shotPixel(layout, shot.x, shot.y);
  const aim = shotPixel(layout, shot.toX, shot.toY);
  const dx = aim.x - pos.x;
  const dy = aim.y - pos.y;
  const frame = frames[arrowFrameIndex(dx, dy, frames.length)] ?? frames[0]!;
  sprite.texture = frame;
  sprite.anchor.set(0.5);
  sprite.scale.set(scale);
  sprite.position.set(pos.x, pos.y);
  sprite.visible = true;
}

function layoutOrbSprite(
  sprite: Sprite,
  layout: GridLayout,
  shot: TowerShot,
  frames: Texture[],
  sizeInTile: number,
  level: number,
): void {
  const pos = shotPixel(layout, shot.x, shot.y);
  const frame =
    frames[projectileVariantIndex(level, frames.length)] ?? frames[0]!;
  sprite.texture = frame;
  sprite.anchor.set(0.5);
  const long = Math.max(frame.width, frame.height);
  const scale = (layout.tileSize * sizeInTile) / Math.max(1, long);
  sprite.scale.set(scale);
  sprite.position.set(pos.x, pos.y);
  sprite.visible = true;
}

function syncShotSprites(
  pool: Sprite[],
  layer: Container,
  shots: readonly TowerShot[],
  frames: Texture[],
  layoutShot: (sprite: Sprite, shot: TowerShot) => void,
): void {
  while (pool.length < shots.length) {
    const sprite = new Sprite(frames[0]);
    sprite.eventMode = "none";
    sprite.anchor.set(0.5);
    layer.addChild(sprite);
    pool.push(sprite);
  }
  for (let i = 0; i < pool.length; i += 1) {
    const sprite = pool[i]!;
    const shot = shots[i];
    if (!shot) {
      sprite.visible = false;
      continue;
    }
    layoutShot(sprite, shot);
  }
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

export type RangePreview = {
  readonly x: number;
  readonly y: number;
  readonly range: number;
};

type OccupantClip = "idle" | "attack";

type TowerSprite = {
  sprite: AnimatedSprite;
  occupant: AnimatedSprite;
  roof: Sprite;
  wall: Sprite;
  roofFromTop: number;
  wallTop: number;
  visual: string;
  occupantClip: OccupantClip | "none";
  occupantVariant: number;
  occupantFacing: 1 | -1;
};

function occupantFacingFor(faceRight: boolean, clip: OccupantClip): 1 | -1 {
  if (clip === "attack") {
    return faceRight ? -1 : 1;
  }
  return faceRight ? 1 : -1;
}

function applyOccupantVisual(
  record: TowerSprite,
  tower: Tower,
  firing: boolean,
  shot: TowerShot | undefined,
  atlas: OccupantAtlas,
): void {
  const show =
    tower.typeId !== "wall" && (isTowerComplete(tower) || tower.level > 1);
  const occupant = record.occupant;
  occupant.visible = show;
  if (!show) {
    if (occupant.playing) {
      occupant.stop();
    }
    record.occupantClip = "none";
    return;
  }
  const clip: OccupantClip = firing ? "attack" : "idle";
  const variant = occupantVariantIndex(tower.level, atlas[tower.typeId].length);
  const faceRight = shot ? shot.toX >= tower.x : false;
  const facing = occupantFacingFor(faceRight, clip);
  const stillIdle = tower.typeId === "cannon" && clip === "idle";
  if (record.occupantClip !== clip || record.occupantVariant !== variant) {
    record.occupantClip = clip;
    record.occupantVariant = variant;
    occupant.textures = occupantClipFrames(atlas, tower.typeId, clip, tower.level);
    occupant.animationSpeed =
      clip === "attack" ? OCCUPANT_ATTACK_SPEED : OCCUPANT_IDLE_SPEED;
    if (stillIdle) {
      occupant.loop = false;
      occupant.gotoAndStop(0);
    } else {
      occupant.loop = true;
      occupant.gotoAndPlay(0);
    }
  } else if (stillIdle) {
    if (occupant.playing) {
      occupant.gotoAndStop(0);
    }
  } else if (!occupant.playing) {
    occupant.play();
  }
  record.occupantFacing = facing;
}

function syncTowerFrontFrames(record: TowerSprite): void {
  const roofTex = towerRoofTexture(record.sprite.texture, record.roofFromTop);
  if (!roofTex) {
    record.roof.visible = false;
  } else {
    record.roof.texture = roofTex;
    record.roof.visible = record.sprite.visible;
  }
  const wallTex = towerWallTexture(record.sprite.texture, record.wallTop);
  if (!wallTex) {
    record.wall.visible = false;
  } else {
    record.wall.texture = wallTex;
    record.wall.visible = record.sprite.visible;
  }
}

function applyTowerFront(record: TowerSprite, tower: Tower): void {
  const overlay = isTowerComplete(tower);
  record.roofFromTop = overlay ? towerRoofFromTop(tower.typeId, tower.level) : 0;
  record.wallTop = overlay ? towerWallFromTop(tower.typeId, tower.level) : 0;
  syncTowerFrontFrames(record);
  if (record.wall.visible) {
    layoutTowerWallSprite(record.wall, record.sprite, record.wallTop);
    record.wall.zIndex = tower.y;
  }
  if (record.roof.visible) {
    layoutTowerRoofSprite(record.roof, record.sprite, record.roofFromTop);
    record.roof.zIndex = tower.y + 0.1;
  }
}

function towerVisualKey(tower: Tower): string {
  return isTowerComplete(tower) ? `idle-${tower.level}` : `work-${tower.level}`;
}

function applyTowerVisual(
  record: TowerSprite,
  tower: Tower,
  firing: boolean,
  atlas: TowerAtlasMap,
): void {
  const complete = isTowerComplete(tower);
  const key = towerVisualKey(tower);
  const frames = towerVisualFrames(atlas, tower.typeId, complete, tower.level);
  const sprite = record.sprite;
  if (record.visual !== key) {
    record.visual = key;
    sprite.textures = frames;
  }
  sprite.tint = 0xffffff;
  if (!complete) {
    sprite.loop = false;
    if (sprite.playing) {
      sprite.stop();
    }
    const progress = 1 - tower.buildTimeLeft / towerWorkDuration(tower);
    const frame = Math.min(
      frames.length - 1,
      Math.max(0, Math.floor(progress * frames.length)),
    );
    sprite.gotoAndStop(frame);
    return;
  }
  if (tower.typeId === "cannon" || tower.typeId === "wall") {
    if (firing && tower.typeId === "cannon") {
      sprite.loop = true;
      sprite.animationSpeed = TOWER_FIRE_ANIMATION_SPEED;
      if (!sprite.playing) {
        sprite.gotoAndPlay(0);
      }
    } else {
      sprite.loop = false;
      if (sprite.playing) {
        sprite.stop();
      }
      sprite.gotoAndStop(0);
    }
    return;
  }
  sprite.loop = true;
  sprite.animationSpeed = firing
    ? TOWER_FIRE_ANIMATION_SPEED
    : TOWER_ANIMATION_SPEED;
  if (!sprite.playing) {
    sprite.play();
  }
}

export function createGridView(
  towerAtlas: TowerAtlasMap,
  occupantAtlas: OccupantAtlas,
  floorTexture: Texture,
  enemyAtlas: EnemyAtlas,
  allyWalk: Texture[],
  arrowFrames: Texture[],
  cannonProjFrames: Texture[],
  mageProjFrames: Texture[],
  obstacleAtlas: ObstacleAtlas,
  startFrames: Texture[],
  baseFrames: Texture[],
): {
  readonly container: Container;
  sync(
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
    units?: readonly Unit[],
    towerShots?: readonly TowerShot[],
    rangePreview?: RangePreview | null,
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
  const occupantLayer = new Container();
  occupantLayer.sortableChildren = true;
  const roofLayer = new Container();
  roofLayer.sortableChildren = true;
  const hpGraphics = new Graphics();
  hpGraphics.eventMode = "none";
  const unitLayer = new Container();
  unitLayer.sortableChildren = true;
  unitLayer.eventMode = "none";
  const arrowLayer = new Container();
  arrowLayer.eventMode = "none";
  const towers = new Map<string, TowerSprite>();
  const obstacles = new Map<string, Sprite>();
  const buildLabels = new Map<string, Text>();
  const unitSprites = new Map<number, UnitSprite>();
  const arrowSprites: Sprite[] = [];
  const cannonSprites: Sprite[] = [];
  const mageSprites: Sprite[] = [];
  let lastLayout: GridLayout | null = null;
  const startSprite = new AnimatedSprite({
    textures: startFrames,
    animationSpeed: START_ANIMATION_SPEED,
    loop: true,
    autoPlay: false,
  });
  startSprite.anchor.set(0.5, 1);
  startSprite.eventMode = "none";
  startSprite.play();
  towerLayer.addChild(startSprite);
  const baseSprite = new AnimatedSprite({
    textures: baseFrames,
    animationSpeed: BASE_ANIMATION_SPEED,
    loop: true,
    autoPlay: false,
  });
  baseSprite.anchor.set(0.5, 1);
  baseSprite.eventMode = "none";
  baseSprite.play();
  towerLayer.addChild(baseSprite);
  container.addChild(
    floor,
    graphics,
    pathGraphics,
    towerLayer,
    occupantLayer,
    roofLayer,
    unitLayer,
    arrowLayer,
    hpGraphics,
  );

  const hideTowers = (): void => {
    for (const record of towers.values()) {
      record.sprite.visible = false;
      record.occupant.visible = false;
      record.roof.visible = false;
      record.wall.visible = false;
    }
    for (const sprite of obstacles.values()) {
      sprite.visible = false;
    }
    for (const label of buildLabels.values()) {
      label.visible = false;
    }
    for (const sprite of arrowSprites) {
      sprite.visible = false;
    }
    for (const sprite of cannonSprites) {
      sprite.visible = false;
    }
    for (const sprite of mageSprites) {
      sprite.visible = false;
    }
  };

  const sync = (
    grid: Grid,
    viewportWidth: number,
    viewportHeight: number,
    units: readonly Unit[] = [],
    towerShots: readonly TowerShot[] = [],
    rangePreview: RangePreview | null = null,
  ): void => {
    graphics.clear();
    pathGraphics.clear();
    hpGraphics.clear();
    const layout = fitGridToViewport(grid, viewportWidth, viewportHeight);
    lastLayout = layout;
    if (layout.tileSize <= 0) {
      floor.visible = false;
      startSprite.visible = false;
      baseSprite.visible = false;
      hideTowers();
      for (const record of unitSprites.values()) {
        record.sprite.visible = false;
        record.sprite.stop();
      }
      return;
    }
    layoutFloor(floor, floorTexture, layout);
    layoutStartSprite(startSprite, layout, grid.start.x, grid.start.y);
    if (!startSprite.playing) {
      startSprite.play();
    }
    layoutBaseSprite(baseSprite, layout, grid.base.x, grid.base.y);
    if (!baseSprite.playing) {
      baseSprite.play();
    }

    const firingKeys = new Set(
      towerShots.map((shot) => tileKey(shot.fromX, shot.fromY)),
    );
    const shotByTower = new Map<string, TowerShot>();
    for (const shot of towerShots) {
      shotByTower.set(tileKey(shot.fromX, shot.fromY), shot);
    }
    const liveTowers = new Set<string>();
    const liveObstacles = new Set<string>();
    const liveBuilding = new Set<string>();
    forEachTile(grid, (x, y) => {
      const px = layout.originX + x * layout.tileSize;
      const py = layout.originY + y * layout.tileSize;
      const kind = tileKind(grid, x, y);
      if (kind === "obstacle") {
        const obstacle = getObstacle(grid, x, y);
        if (obstacle) {
          const key = tileKey(x, y);
          liveObstacles.add(key);
          let sprite = obstacles.get(key);
          if (!sprite) {
            sprite = new Sprite(obstacleTexture(obstacleAtlas, obstacle.kind, x, y));
            sprite.eventMode = "none";
            sprite.anchor.set(0.5, 1);
            towerLayer.addChild(sprite);
            obstacles.set(key, sprite);
          }
          layoutObstacleSprite(
            sprite,
            layout,
            obstacle,
            obstacleTexture(obstacleAtlas, obstacle.kind, x, y),
          );
          drawTowerHp(
            hpGraphics,
            layout,
            x,
            y,
            obstacle.hp,
            obstacleMaxHp(obstacle.kind),
          );
        }
        graphics
          .rect(px, py, layout.tileSize, layout.tileSize)
          .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });
        return;
      }
      graphics
        .rect(px, py, layout.tileSize, layout.tileSize)
        .stroke({ width: 1, color: TILE_BORDER, alignment: 0 });

      if (kind !== "tower") {
        return;
      }
      const tower = getTower(grid, x, y);
      if (!tower) {
        return;
      }
      const key = tileKey(x, y);
      liveTowers.add(key);
      let record = towers.get(key);
      if (!record) {
        const sprite = new AnimatedSprite({
          textures: towerVisualFrames(towerAtlas, tower.typeId, false, 1),
          animationSpeed: TOWER_ANIMATION_SPEED,
          loop: true,
          autoPlay: false,
        });
        sprite.anchor.set(0.5, 1);
        sprite.eventMode = "none";
        towerLayer.addChild(sprite);
        const occupant = new AnimatedSprite({
          textures: occupantClipFrames(occupantAtlas, tower.typeId, "idle", tower.level),
          animationSpeed: OCCUPANT_IDLE_SPEED,
          loop: true,
          autoPlay: false,
        });
        occupant.anchor.set(0.5, spriteLayout.occupantAnchorY);
        occupant.eventMode = "none";
        occupantLayer.addChild(occupant);
        const roof = new Sprite(sprite.texture);
        roof.anchor.set(0.5, 1);
        roof.eventMode = "none";
        roof.visible = false;
        roofLayer.addChild(roof);
        const wall = new Sprite(sprite.texture);
        wall.anchor.set(0.5, 0);
        wall.eventMode = "none";
        wall.visible = false;
        roofLayer.addChild(wall);
        const created: TowerSprite = {
          sprite,
          occupant,
          roof,
          wall,
          roofFromTop: 0,
          wallTop: 0,
          visual: "",
          occupantClip: "none",
          occupantVariant: -1,
          occupantFacing: 1,
        };
        sprite.onFrameChange = () => {
          syncTowerFrontFrames(created);
        };
        record = created;
        towers.set(key, created);
      }
      record.sprite.visible = true;
      const firing = firingKeys.has(key);
      applyTowerVisual(record, tower, firing, towerAtlas);
      applyOccupantVisual(record, tower, firing, shotByTower.get(key), occupantAtlas);
      layoutTowerSprite(record.sprite, layout, x, y);
      layoutOccupantSprite(
        record.occupant,
        record.sprite,
        layout,
        y,
        record.occupantFacing,
        tower,
      );
      applyTowerFront(record, tower);
      drawTowerHp(
        hpGraphics,
        layout,
        x,
        y,
        tower.hp,
        towerMaxHp(tower),
        true,
      );
      if (isTowerComplete(tower)) {
        drawLevelPips(hpGraphics, layout, x, y, tower.level);
      } else {
        liveBuilding.add(key);
        const progress = 1 - tower.buildTimeLeft / towerWorkDuration(tower);
        drawConstruction(graphics, layout, x, y, progress);
        let label = buildLabels.get(key);
        if (!label) {
          label = new Text({
            text: "건설 중",
            style: {
              fontFamily: "Segoe UI, sans-serif",
              fontWeight: "700",
              fill: 0xf4d35e,
              align: "center",
            },
          });
          label.anchor.set(0.5);
          label.eventMode = "none";
          container.addChild(label);
          buildLabels.set(key, label);
        }
        label.text = tower.level > 1 ? "업그레이드 중" : "건설 중";
        label.visible = true;
        label.style.fontSize = Math.max(9, Math.floor(layout.tileSize * 0.22));
        label.position.set(
          layout.originX + (x + 0.5) * layout.tileSize,
          layout.originY + (y + 0.42) * layout.tileSize,
        );
      }
    });

    const path = findPath(grid);
    if (path) {
      drawPath(pathGraphics, layout, path);
    }
    if (rangePreview) {
      drawRangePreview(
        pathGraphics,
        layout,
        rangePreview.x,
        rangePreview.y,
        rangePreview.range,
      );
    }

    const liveUnits = new Set<number>();
    for (const unit of units) {
      liveUnits.add(unit.id);
      let record = unitSprites.get(unit.id);
      if (!record) {
        const sprite = new AnimatedSprite({
          textures: unitWalkTextures(unit.kind, unit.enemyType, enemyAtlas, allyWalk),
          animationSpeed: ENEMY_ANIMATION_SPEED,
          loop: true,
          autoPlay: false,
        });
        sprite.anchor.set(0.5, ENEMY_ANCHOR_Y[unit.enemyType ?? "beast"]);
        sprite.eventMode = "none";
        unitLayer.addChild(sprite);
        record = {
          sprite,
          lastX: unit.x,
          lastY: unit.y,
          facing: -1,
          clip: "walk",
          kind: unit.kind,
          enemyType: unit.enemyType,
          hue: unit.hue,
        };
        applyUnitHue(sprite, unit.hue);
        unitSprites.set(unit.id, record);
      } else if (record.hue !== unit.hue) {
        record.hue = unit.hue;
        applyUnitHue(record.sprite, unit.hue);
      }
      const dx = unit.x - record.lastX;
      const moving = Math.hypot(dx, unit.y - record.lastY) > UNIT_MOVE_EPS;
      if (unit.attackTile) {
        record.facing = horizontalFacing(unit.attackTile.x - unit.x, record.facing);
      } else {
        record.facing = horizontalFacing(dx, record.facing);
      }
      const clip: EnemyClip = unit.attackTile ? "attack" : "walk";
      if (
        record.kind !== unit.kind ||
        record.enemyType !== unit.enemyType ||
        record.clip !== clip
      ) {
        record.kind = unit.kind;
        record.enemyType = unit.enemyType;
        record.clip = clip;
        record.sprite.loop = true;
        record.sprite.textures = unitClipTextures(
          unit.kind,
          unit.enemyType,
          clip,
          enemyAtlas,
          allyWalk,
        );
        record.sprite.animationSpeed =
          clip === "attack" && unit.kind !== "ally"
            ? ENEMY_ATTACK_ANIMATION_SPEED
            : ENEMY_ANIMATION_SPEED;
      }
      record.sprite.visible = true;
      layoutEnemySprite(record.sprite, layout, unit, record.facing, record.enemyType);
      drawUnitHp(hpGraphics, layout, unit, record.sprite);
      if (clip === "attack" || moving) {
        if (!record.sprite.playing) {
          record.sprite.play();
        }
      } else if (record.sprite.playing) {
        record.sprite.stop();
      }
      record.lastX = unit.x;
      record.lastY = unit.y;
    }

    for (const [key, record] of towers) {
      if (!liveTowers.has(key)) {
        record.sprite.destroy();
        record.occupant.destroy();
        record.roof.destroy();
        record.wall.destroy();
        towers.delete(key);
      }
    }
    for (const [key, sprite] of obstacles) {
      if (!liveObstacles.has(key)) {
        sprite.destroy();
        obstacles.delete(key);
      }
    }
    for (const [key, label] of buildLabels) {
      if (!liveBuilding.has(key)) {
        label.destroy();
        buildLabels.delete(key);
      }
    }
    for (const [id, record] of unitSprites) {
      if (liveUnits.has(id)) {
        continue;
      }
      if (record.clip === "death") {
        layoutEnemySprite(
          record.sprite,
          layout,
          { x: record.lastX, y: record.lastY },
          record.facing,
          record.enemyType,
        );
        continue;
      }
      const atBase =
        Math.hypot(record.lastX - grid.base.x, record.lastY - grid.base.y) <=
        BASE_ARRIVE_EPS;
      if (record.kind === "enemy" && !atBase) {
        record.clip = "death";
        record.sprite.loop = false;
        record.sprite.textures = unitClipTextures(
          record.kind,
          record.enemyType,
          "death",
          enemyAtlas,
          allyWalk,
        );
        record.sprite.animationSpeed = ENEMY_DEATH_ANIMATION_SPEED;
        record.sprite.onComplete = () => {
          record.sprite.destroy();
          unitSprites.delete(id);
        };
        record.sprite.gotoAndPlay(0);
        layoutEnemySprite(
          record.sprite,
          layout,
          { x: record.lastX, y: record.lastY },
          record.facing,
          record.enemyType,
        );
        continue;
      }
      record.sprite.destroy();
      unitSprites.delete(id);
    }

    const arrowScale = arrowUniformScale(
      arrowFrames,
      layout.tileSize,
      spriteLayout.arrowLengthInTile,
    );
    syncShotSprites(
      arrowSprites,
      arrowLayer,
      towerShots.filter((shot) => shot.typeId === "archer"),
      arrowFrames,
      (sprite, shot) =>
        layoutArrowSprite(sprite, layout, shot, arrowFrames, arrowScale),
    );
    syncShotSprites(
      cannonSprites,
      arrowLayer,
      towerShots.filter((shot) => shot.typeId === "cannon"),
      cannonProjFrames,
      (sprite, shot) => {
        const tower = getTower(grid, shot.fromX, shot.fromY);
        layoutOrbSprite(
          sprite,
          layout,
          shot,
          cannonProjFrames,
          spriteLayout.cannonProjSizeInTile,
          tower?.level ?? 1,
        );
      },
    );
    syncShotSprites(
      mageSprites,
      arrowLayer,
      towerShots.filter((shot) => shot.typeId === "mage"),
      mageProjFrames,
      (sprite, shot) => {
        const tower = getTower(grid, shot.fromX, shot.fromY);
        layoutOrbSprite(
          sprite,
          layout,
          shot,
          mageProjFrames,
          spriteLayout.mageProjSizeInTile,
          tower?.level ?? 1,
        );
      },
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
