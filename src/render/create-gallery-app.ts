import {
  AnimatedSprite,
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TilingSprite,
  type FederatedPointerEvent,
  type Texture,
} from "pixi.js";
import {
  fitGridToViewport,
  viewportToTile,
  type Grid,
  type GridLayout,
  type Obstacle,
  type Tower,
} from "@/core";
import { loadAllyFrames } from "@/render/ally-sprites";
import { arrowUniformScale, loadArrowFrames } from "@/render/arrow-sprites";
import { loadEnemyFrames, type EnemyAtlas } from "@/render/enemy-sprites";
import { loadFloorTexture } from "@/render/floor-tile";
import {
  galleryItemsFor,
  itemHasOccupant,
  type GalleryGroup,
  type GalleryItem,
} from "@/render/gallery-catalog";
import { loadOccupantFrames, occupantClipFrames } from "@/render/occupant-sprites";
import {
  loadObstacleFrames,
  obstacleTextureByIndex,
  type ObstacleAtlas,
} from "@/render/obstacle-sprites";
import {
  loadCannonProjectileFrames,
  loadMageProjectileFrames,
} from "@/render/projectile-sprites";
import {
  layoutCenteredSprite,
  layoutEnemySprite,
  layoutOccupantSprite,
  layoutObstacleSprite,
  layoutTowerRoofSprite,
  layoutTowerSprite,
  layoutTowerWallSprite,
  spriteLayout,
  towerRoofFromTop,
  towerWallFromTop,
} from "@/render/sprite-layout";
import {
  loadTowerFrames,
  towerRoofTexture,
  towerVisualFrames,
  towerWallTexture,
  type TowerAtlasMap,
} from "@/render/tower-sprites";

const START_FILL = 0x2f6fb3;
const BASE_FILL = 0xb45a28;
const TILE_BORDER = 0x161c16;
const CHECK_DARK = 0x1c2418;
const CHECK_LIGHT = 0x2a3424;
const SELECT_FILL = 0xe8b060;
const GROUND_LINE = 0xf4d35e;
const TOWER_ANIMATION_SPEED = 0.08;
const OCCUPANT_IDLE_SPEED = 0.1;
const ENEMY_ANIMATION_SPEED = 0.14;
const GALLERY_COLS = 8;
const SLOT_TILE_ROWS = 2;
const VIEW_PADDING = 20;

export type GalleryViewState = {
  readonly selectedId: string | null;
  readonly group: GalleryGroup | "all";
  readonly layoutRev: number;
};

type GalleryAssets = {
  readonly towerAtlas: TowerAtlasMap;
  readonly occupantAtlas: Awaited<ReturnType<typeof loadOccupantFrames>>;
  readonly floorTexture: Texture;
  readonly enemyAtlas: EnemyAtlas;
  readonly allyWalk: Texture[];
  readonly arrowFrames: Texture[];
  readonly cannonProjFrames: Texture[];
  readonly mageProjFrames: Texture[];
  readonly obstacleAtlas: ObstacleAtlas;
};

type SlotRecord = {
  readonly item: GalleryItem;
  readonly col: number;
  readonly groundY: number;
  tower: AnimatedSprite | null;
  occupant: AnimatedSprite | null;
  roof: Sprite | null;
  wall: Sprite | null;
  unit: AnimatedSprite | null;
  sprite: Sprite | null;
  readonly label: Text;
};

type GallerySession = {
  cleanup: () => void;
  setState: (state: GalleryViewState) => void;
  tileSize: () => number;
};

const sessions = new WeakMap<Application, GallerySession>();

function galleryGrid(cols: number, rows: number): Grid {
  return {
    cols,
    rows,
    start: { x: 0, y: 0 },
    base: { x: cols - 1, y: rows - 1 },
    towers: [],
    obstacles: [],
  };
}

function dummyTower(item: Extract<GalleryItem, { group: "tower" }>, x: number, y: number): Tower {
  return {
    x,
    y,
    typeId: item.typeId,
    level: item.level,
    hp: 1,
    buildTimeLeft: 0,
  };
}

function applyGalleryFront(record: SlotRecord): void {
  const roof = record.roof;
  const wall = record.wall;
  const towerSprite = record.tower;
  const item = record.item;
  if (!towerSprite || item.group !== "tower") {
    return;
  }
  const overlay = item.group === "tower";
  const roofFromTop = overlay ? towerRoofFromTop(item.typeId, item.level) : 0;
  const wallTop = overlay ? towerWallFromTop(item.typeId, item.level) : 0;
  if (wall) {
    const tex = towerWallTexture(towerSprite.texture, wallTop);
    if (!tex) {
      wall.visible = false;
    } else {
      wall.texture = tex;
      layoutTowerWallSprite(wall, towerSprite, wallTop);
      wall.zIndex = record.groundY + 0.4;
    }
  }
  if (roof) {
    const tex = towerRoofTexture(towerSprite.texture, roofFromTop);
    if (!tex) {
      roof.visible = false;
    } else {
      roof.texture = tex;
      layoutTowerRoofSprite(roof, towerSprite, roofFromTop);
      roof.zIndex = record.groundY + 0.5;
    }
  }
}

function dummyObstacle(
  item: Extract<GalleryItem, { group: "obstacle" }>,
  x: number,
  y: number,
): Obstacle {
  return { x, y, kind: item.obstacleKind, hp: 1 };
}

function layoutSlot(
  record: SlotRecord,
  layout: GridLayout,
  assets: GalleryAssets,
): void {
  const x = record.col;
  const y = record.groundY;
  const item = record.item;
  if (item.group === "tower" && record.tower) {
    const tower = dummyTower(item, x, y);
    layoutTowerSprite(record.tower, layout, x, y);
    if (record.occupant) {
      layoutOccupantSprite(record.occupant, record.tower, layout, y, 1, tower);
    }
    applyGalleryFront(record);
  } else if ((item.group === "enemy" || item.group === "ally") && record.unit) {
    const enemyType = item.group === "enemy" ? item.enemyType : null;
    layoutEnemySprite(record.unit, layout, { x, y }, -1, enemyType);
  } else if (item.group === "obstacle" && record.sprite) {
    layoutObstacleSprite(
      record.sprite,
      layout,
      dummyObstacle(item, x, y),
      obstacleTextureByIndex(assets.obstacleAtlas, item.obstacleKind, item.variant),
    );
  } else if (item.group === "projectile" && record.sprite) {
    const size =
      item.projectile === "arrow"
        ? spriteLayout.arrowLengthInTile
        : item.projectile === "cannon"
          ? spriteLayout.cannonProjSizeInTile
          : spriteLayout.mageProjSizeInTile;
    if (item.projectile === "arrow") {
      record.sprite.texture = assets.arrowFrames[0] ?? record.sprite.texture;
      record.sprite.anchor.set(0.5);
      record.sprite.scale.set(
        arrowUniformScale(assets.arrowFrames, layout.tileSize, spriteLayout.arrowLengthInTile),
      );
      record.sprite.position.set(
        layout.originX + (x + 0.5) * layout.tileSize,
        layout.originY + (y + 0.5) * layout.tileSize,
      );
      record.sprite.visible = true;
    } else {
      layoutCenteredSprite(record.sprite, layout, x, y, size);
    }
  }
  record.label.style.fontSize = Math.max(9, Math.floor(layout.tileSize * 0.18));
  record.label.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY + (y - 1) * layout.tileSize + 3,
  );
}

function createSlot(
  item: GalleryItem,
  col: number,
  groundY: number,
  assets: GalleryAssets,
  layer: Container,
  labelLayer: Container,
): SlotRecord {
  const record: SlotRecord = {
    item,
    col,
    groundY,
    tower: null,
    occupant: null,
    roof: null,
    wall: null,
    unit: null,
    sprite: null,
    label: new Text({
      text: item.label,
      style: {
        fontFamily: "Segoe UI, sans-serif",
        fontWeight: "700",
        fill: 0xf4f1ea,
        align: "center",
        stroke: { color: 0x1a1410, width: 4 },
      },
    }),
  };
  record.label.anchor.set(0.5, 0);
  record.label.eventMode = "none";
  labelLayer.addChild(record.label);

  if (item.group === "tower") {
    const sprite = new AnimatedSprite({
      textures: towerVisualFrames(assets.towerAtlas, item.typeId, true, item.level),
      animationSpeed: TOWER_ANIMATION_SPEED,
      loop: true,
      autoPlay: false,
    });
    sprite.anchor.set(0.5, 1);
    sprite.eventMode = "none";
    sprite.play();
    layer.addChild(sprite);
    record.tower = sprite;
    const roof = new Sprite(sprite.texture);
    roof.anchor.set(0.5, 1);
    roof.eventMode = "none";
    roof.visible = false;
    layer.addChild(roof);
    record.roof = roof;
    const wall = new Sprite(sprite.texture);
    wall.anchor.set(0.5, 0);
    wall.eventMode = "none";
    wall.visible = false;
    layer.addChild(wall);
    record.wall = wall;
    sprite.onFrameChange = () => {
      applyGalleryFront(record);
    };
    if (itemHasOccupant(item)) {
      const occupant = new AnimatedSprite({
        textures: occupantClipFrames(
          assets.occupantAtlas,
          item.typeId,
          "idle",
          item.level,
        ),
        animationSpeed: OCCUPANT_IDLE_SPEED,
        loop: true,
        autoPlay: false,
      });
      occupant.anchor.set(0.5, spriteLayout.occupantAnchorY);
      occupant.eventMode = "none";
      occupant.play();
      layer.addChild(occupant);
      record.occupant = occupant;
    }
  } else if (item.group === "enemy" || item.group === "ally") {
    const textures =
      item.group === "ally" ? assets.allyWalk : assets.enemyAtlas[item.enemyType].walk;
    const sprite = new AnimatedSprite({
      textures,
      animationSpeed: ENEMY_ANIMATION_SPEED,
      loop: true,
      autoPlay: false,
    });
    const enemyType = item.group === "enemy" ? item.enemyType : "beast";
    sprite.anchor.set(
      0.5,
      item.group === "ally" ? spriteLayout.allyAnchorY : spriteLayout.enemyAnchorY[enemyType],
    );
    sprite.eventMode = "none";
    sprite.play();
    layer.addChild(sprite);
    record.unit = sprite;
  } else if (item.group === "obstacle") {
    const sprite = new Sprite(
      obstacleTextureByIndex(assets.obstacleAtlas, item.obstacleKind, item.variant),
    );
    sprite.eventMode = "none";
    layer.addChild(sprite);
    record.sprite = sprite;
  } else if (item.group === "projectile") {
    const frames =
      item.projectile === "arrow"
        ? assets.arrowFrames
        : item.projectile === "cannon"
          ? assets.cannonProjFrames
          : assets.mageProjFrames;
    const sprite = new Sprite(frames[item.variant] ?? frames[0]);
    sprite.eventMode = "none";
    layer.addChild(sprite);
    record.sprite = sprite;
  }
  return record;
}

function drawBoard(
  graphics: Graphics,
  layout: GridLayout,
  cols: number,
  rows: number,
  slots: readonly SlotRecord[],
  selectedId: string | null,
): void {
  graphics.clear();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = layout.originX + x * layout.tileSize;
      const py = layout.originY + y * layout.tileSize;
      const fill = (x + y) % 2 === 0 ? CHECK_LIGHT : CHECK_DARK;
      graphics.rect(px, py, layout.tileSize, layout.tileSize).fill({
        color: fill,
        alpha: 0.55,
      });
      graphics.rect(px, py, layout.tileSize, layout.tileSize).stroke({
        width: 1,
        color: TILE_BORDER,
        alignment: 0,
      });
    }
  }
  for (const slot of slots) {
    const x = slot.col;
    const y = slot.groundY;
    const px = layout.originX + x * layout.tileSize;
    const py = layout.originY + y * layout.tileSize;
    if (slot.item.group === "marker") {
      graphics.rect(px, py, layout.tileSize, layout.tileSize).fill({
        color: slot.item.marker === "start" ? START_FILL : BASE_FILL,
        alpha: 0.7,
      });
    }
    const cx = px + layout.tileSize / 2;
    const cy = py + layout.tileSize / 2;
    const tick = Math.max(4, layout.tileSize * 0.12);
    graphics.moveTo(cx - tick, cy);
    graphics.lineTo(cx + tick, cy);
    graphics.moveTo(cx, cy - tick);
    graphics.lineTo(cx, cy + tick);
    graphics.stroke({ width: 1, color: 0xf4f1ea, alpha: 0.35 });
    graphics
      .moveTo(px + 2, py + layout.tileSize - 1)
      .lineTo(px + layout.tileSize - 2, py + layout.tileSize - 1)
      .stroke({
        width: Math.max(2, layout.tileSize * 0.04),
        color: GROUND_LINE,
        alpha: 0.85,
      });
    if (selectedId === slot.item.id) {
      graphics.rect(px, py, layout.tileSize, layout.tileSize).stroke({
        width: Math.max(2, layout.tileSize * 0.06),
        color: SELECT_FILL,
        alignment: 0,
      });
    }
  }
}

export async function createGalleryApp(
  host: HTMLElement,
  onSelect: (id: string | null) => void,
  onLayout: (tileSize: number) => void,
): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x141418,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  host.appendChild(app.canvas);

  const [
    towerAtlas,
    occupantAtlas,
    floorTexture,
    enemyAtlas,
    allyWalk,
    arrowFrames,
    cannonProjFrames,
    mageProjFrames,
    obstacleAtlas,
  ] = await Promise.all([
    loadTowerFrames(),
    loadOccupantFrames(),
    loadFloorTexture(),
    loadEnemyFrames(),
    loadAllyFrames(),
    loadArrowFrames(),
    loadCannonProjectileFrames(),
    loadMageProjectileFrames(),
    loadObstacleFrames(),
  ]);
  const assets: GalleryAssets = {
    towerAtlas,
    occupantAtlas,
    floorTexture,
    enemyAtlas,
    allyWalk,
    arrowFrames,
    cannonProjFrames,
    mageProjFrames,
    obstacleAtlas,
  };

  const container = new Container();
  const floor = new TilingSprite({ texture: floorTexture, width: 1, height: 1 });
  floor.eventMode = "none";
  const graphics = new Graphics();
  const spriteLayer = new Container();
  spriteLayer.sortableChildren = true;
  const labelLayer = new Container();
  labelLayer.eventMode = "none";
  container.addChild(floor, graphics, spriteLayer, labelLayer);
  app.stage.addChild(container);
  app.stage.eventMode = "static";
  app.stage.cursor = "pointer";

  let state: GalleryViewState = { selectedId: null, group: "all", layoutRev: 0 };
  let slots: SlotRecord[] = [];
  let lastLayout: GridLayout | null = null;
  let lastCols = 0;
  let lastRows = 0;

  const rebuildSlots = (): void => {
    spriteLayer.removeChildren().forEach((child) => child.destroy());
    labelLayer.removeChildren().forEach((child) => child.destroy());
    const items = galleryItemsFor(state.group);
    slots = items.map((item, index) => {
      const col = index % GALLERY_COLS;
      const slotRow = Math.floor(index / GALLERY_COLS);
      const groundY = slotRow * SLOT_TILE_ROWS + 1;
      return createSlot(item, col, groundY, assets, spriteLayer, labelLayer);
    });
  };

  const sync = (): void => {
    const items = galleryItemsFor(state.group);
    const slotRows = Math.max(1, Math.ceil(items.length / GALLERY_COLS));
    const cols = GALLERY_COLS;
    const rows = slotRows * SLOT_TILE_ROWS;
    lastCols = cols;
    lastRows = rows;
    const layout = fitGridToViewport(
      galleryGrid(cols, rows),
      app.screen.width,
      app.screen.height,
      VIEW_PADDING,
    );
    lastLayout = layout;
    app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
    if (layout.tileSize <= 0) {
      floor.visible = false;
      graphics.clear();
      onLayout(0);
      return;
    }
    floor.visible = true;
    floor.position.set(layout.originX, layout.originY);
    floor.width = layout.width;
    floor.height = layout.height;
    floor.tileScale.set(
      layout.tileSize / floorTexture.width,
      layout.tileSize / floorTexture.height,
    );
    drawBoard(graphics, layout, cols, rows, slots, state.selectedId);
    for (const slot of slots) {
      layoutSlot(slot, layout, assets);
      if (slot.tower) {
        slot.tower.zIndex = slot.groundY;
      }
      if (slot.occupant) {
        slot.occupant.zIndex = slot.groundY + 0.2;
      }
      if (slot.wall) {
        slot.wall.zIndex = slot.groundY + 0.4;
      }
      if (slot.roof) {
        slot.roof.zIndex = slot.groundY + 0.5;
      }
      if (slot.unit) {
        slot.unit.zIndex = slot.groundY;
      }
      if (slot.sprite) {
        slot.sprite.zIndex = slot.groundY;
      }
    }
    onLayout(layout.tileSize);
  };

  rebuildSlots();
  sync();

  const onPointerTap = (event: FederatedPointerEvent): void => {
    if (!lastLayout) {
      return;
    }
    const tile = viewportToTile(lastLayout, event.global.x, event.global.y);
    if (!tile || tile.x < 0 || tile.x >= lastCols || tile.y < 0 || tile.y >= lastRows) {
      onSelect(null);
      return;
    }
    const slotRow = Math.floor(tile.y / SLOT_TILE_ROWS);
    const hit = slots.find((slot) => slot.col === tile.x && Math.floor(slot.groundY / SLOT_TILE_ROWS) === slotRow);
    onSelect(hit?.item.id ?? null);
  };
  app.stage.on("pointertap", onPointerTap);
  const onResize = (): void => {
    sync();
  };
  app.renderer.on("resize", onResize);

  sessions.set(app, {
    cleanup: () => {
      app.stage.off("pointertap", onPointerTap);
      app.renderer.off("resize", onResize);
    },
    setState: (next) => {
      const groupChanged = next.group !== state.group;
      state = next;
      if (groupChanged) {
        rebuildSlots();
      }
      sync();
    },
    tileSize: () => lastLayout?.tileSize ?? 0,
  });

  return app;
}

export function setGalleryState(app: Application, state: GalleryViewState): void {
  sessions.get(app)?.setState(state);
}

export function destroyGalleryApp(app: Application): void {
  sessions.get(app)?.cleanup();
  sessions.delete(app);
  app.destroy(true, { children: true });
}
