import type {
  EnemyTypeId,
  GridLayout,
  Obstacle,
  ObstacleKind,
  Tower,
  TowerTypeId,
  Unit,
} from "@/core";
import type { AnimatedSprite, Sprite, Texture } from "pixi.js";

export type SpriteLayout = {
  towerWidthInTile: number;
  towerFootInTile: number;
  occupantWidthInTile: number;
  occupantAnchorY: number;
  archerAnchorY: number;
  archerDeckInSprite: number[];
  /** 스프라이트 높이에서 위에서부터 지붕으로 덮는 비율. 0이면 지붕 레이어 없음. */
  archerRoofInSprite: number[];
  /** 앞벽 시작(위에서부터). 이 줄부터 스프라이트 맨 아래까지 유닛 앞. */
  archerWallTopInSprite: number[];
  archerOccupantXInTile: number[];
  cannonDeckInSprite: number;
  cannonWidthInTile: number;
  cannonOccupantXInTile: number;
  mageDeckInSprite: number;
  mageOccupantXInTile: number;
  /** 마법사 지붕·수정. 0이면 없음. */
  mageRoofInSprite: number[];
  /** 마법사 앞벽 시작(위에서부터). 여기부터 맨 아래까지 유닛 앞. */
  mageWallTopInSprite: number[];
  arrowLengthInTile: number;
  cannonProjSizeInTile: number;
  mageProjSizeInTile: number;
  rockWidthInTile: number;
  bushWidthInTile: number;
  treeWidthInTile: number;
  obstacleFootInTile: number;
  startWidthInTile: number;
  startFootInTile: number;
  baseWidthInTile: number;
  baseFootInTile: number;
  enemyWidthInTile: Record<EnemyTypeId, number>;
  enemyAnchorY: Record<EnemyTypeId, number>;
  enemyFootInTile: Record<EnemyTypeId, number>;
  enemyXInTile: Record<EnemyTypeId, number>;
  allyWidthInTile: number;
  allyAnchorY: number;
  allyFootInTile: number;
};

/** 배틀·갤러리가 같이 읽는 배치 값. 갤러리에서 고친 이름과 이 필드명이 같다. */
export const spriteLayout: SpriteLayout = {
  towerWidthInTile: 1.05,
  towerFootInTile: 0.06,
  occupantWidthInTile: 0.72,
  occupantAnchorY: 40 / 48,
  archerAnchorY: 32 / 48,
  archerDeckInSprite: [0.381, 0.261, 0.381, 0.381, 0.321],
  archerRoofInSprite: [0, 73 / 130, 0, 0, 70 / 130],
  archerWallTopInSprite: [0, 83 / 130, 0, 0, 76 / 130],
  archerOccupantXInTile: [0, 0, 0, 0, 0],
  cannonDeckInSprite: 0.55,
  cannonWidthInTile: 0.5,
  cannonOccupantXInTile: 0,
  mageDeckInSprite: 0.28,
  mageOccupantXInTile: 0,
  mageRoofInSprite: [59 / 130, 53 / 130, 48 / 130, 63 / 130, 63 / 130],
  mageWallTopInSprite: [0.625, 76 / 130, 72 / 130, 72 / 130, 72 / 130],
  arrowLengthInTile: 0.22,
  cannonProjSizeInTile: 0.38,
  mageProjSizeInTile: 0.32,
  rockWidthInTile: 0.92,
  bushWidthInTile: 0.9,
  treeWidthInTile: 1.08,
  obstacleFootInTile: 0.04,
  startWidthInTile: 0.85,
  startFootInTile: 0.06,
  baseWidthInTile: 0.95,
  baseFootInTile: 0.04,
  enemyWidthInTile: {
    beast: 1.35,
    cavalry: 1.9,
    wolf: 1.4,
    slime: 1.05,
    goblin: 1.25,
  },
  enemyAnchorY: {
    beast: 86 / 96,
    cavalry: 88 / 96,
    wolf: 40 / 48,
    slime: 42 / 48,
    goblin: 38 / 48,
  },
  enemyFootInTile: {
    beast: 1.1,
    cavalry: 1.1,
    wolf: 0.78,
    slime: 0.86,
    goblin: 0.78,
  },
  enemyXInTile: {
    beast: 0,
    cavalry: 0.17,
    wolf: 0,
    slime: 0,
    goblin: 0,
  },
  allyWidthInTile: 1.35,
  allyAnchorY: 86 / 96,
  allyFootInTile:1.11,
};

const SPRITE_LAYOUT_DEFAULTS: SpriteLayout = cloneSpriteLayout(spriteLayout);

function cloneSpriteLayout(src: SpriteLayout): SpriteLayout {
  return {
    ...src,
    archerDeckInSprite: [...src.archerDeckInSprite],
    archerRoofInSprite: [...src.archerRoofInSprite],
    archerWallTopInSprite: [...src.archerWallTopInSprite],
    archerOccupantXInTile: [...src.archerOccupantXInTile],
    mageRoofInSprite: [...src.mageRoofInSprite],
    mageWallTopInSprite: [...src.mageWallTopInSprite],
    enemyWidthInTile: { ...src.enemyWidthInTile },
    enemyAnchorY: { ...src.enemyAnchorY },
    enemyFootInTile: { ...src.enemyFootInTile },
    enemyXInTile: { ...src.enemyXInTile },
  };
}

function copySpriteLayout(from: SpriteLayout, to: SpriteLayout): void {
  to.towerWidthInTile = from.towerWidthInTile;
  to.towerFootInTile = from.towerFootInTile;
  to.occupantWidthInTile = from.occupantWidthInTile;
  to.occupantAnchorY = from.occupantAnchorY;
  to.archerAnchorY = from.archerAnchorY;
  to.archerDeckInSprite.splice(0, to.archerDeckInSprite.length, ...from.archerDeckInSprite);
  to.archerRoofInSprite.splice(0, to.archerRoofInSprite.length, ...from.archerRoofInSprite);
  to.archerWallTopInSprite.splice(0, to.archerWallTopInSprite.length, ...from.archerWallTopInSprite);
  to.archerOccupantXInTile.splice(
    0,
    to.archerOccupantXInTile.length,
    ...from.archerOccupantXInTile,
  );
  to.cannonDeckInSprite = from.cannonDeckInSprite;
  to.cannonWidthInTile = from.cannonWidthInTile;
  to.cannonOccupantXInTile = from.cannonOccupantXInTile;
  to.mageDeckInSprite = from.mageDeckInSprite;
  to.mageOccupantXInTile = from.mageOccupantXInTile;
  to.mageRoofInSprite.splice(0, to.mageRoofInSprite.length, ...from.mageRoofInSprite);
  to.mageWallTopInSprite.splice(0, to.mageWallTopInSprite.length, ...from.mageWallTopInSprite);
  to.arrowLengthInTile = from.arrowLengthInTile;
  to.cannonProjSizeInTile = from.cannonProjSizeInTile;
  to.mageProjSizeInTile = from.mageProjSizeInTile;
  to.rockWidthInTile = from.rockWidthInTile;
  to.bushWidthInTile = from.bushWidthInTile;
  to.treeWidthInTile = from.treeWidthInTile;
  to.obstacleFootInTile = from.obstacleFootInTile;
  to.startWidthInTile = from.startWidthInTile;
  to.startFootInTile = from.startFootInTile;
  to.baseWidthInTile = from.baseWidthInTile;
  to.baseFootInTile = from.baseFootInTile;
  Object.assign(to.enemyWidthInTile, from.enemyWidthInTile);
  Object.assign(to.enemyAnchorY, from.enemyAnchorY);
  Object.assign(to.enemyFootInTile, from.enemyFootInTile);
  Object.assign(to.enemyXInTile, from.enemyXInTile);
  to.allyWidthInTile = from.allyWidthInTile;
  to.allyAnchorY = from.allyAnchorY;
  to.allyFootInTile = from.allyFootInTile;
}

export function resetSpriteLayout(): void {
  copySpriteLayout(SPRITE_LAYOUT_DEFAULTS, spriteLayout);
}

export function roundLayoutValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fmt(value: number): string {
  return String(roundLayoutValue(value));
}

export function formatSpriteLayoutSource(): string {
  const s = spriteLayout;
  const enemyKeys: EnemyTypeId[] = ["beast", "cavalry", "wolf", "slime", "goblin"];
  const enemyBlock = (row: Record<EnemyTypeId, number>) =>
    enemyKeys.map((key) => `    ${key}: ${fmt(row[key])},`).join("\n");
  return `export const spriteLayout: SpriteLayout = {
  towerWidthInTile: ${fmt(s.towerWidthInTile)},
  towerFootInTile: ${fmt(s.towerFootInTile)},
  occupantWidthInTile: ${fmt(s.occupantWidthInTile)},
  occupantAnchorY: ${fmt(s.occupantAnchorY)},
  archerAnchorY: ${fmt(s.archerAnchorY)},
  archerDeckInSprite: [${s.archerDeckInSprite.map(fmt).join(", ")}],
  archerRoofInSprite: [${s.archerRoofInSprite.map(fmt).join(", ")}],
  archerWallTopInSprite: [${s.archerWallTopInSprite.map(fmt).join(", ")}],
  archerOccupantXInTile: [${s.archerOccupantXInTile.map(fmt).join(", ")}],
  cannonDeckInSprite: ${fmt(s.cannonDeckInSprite)},
  cannonWidthInTile: ${fmt(s.cannonWidthInTile)},
  cannonOccupantXInTile: ${fmt(s.cannonOccupantXInTile)},
  mageDeckInSprite: ${fmt(s.mageDeckInSprite)},
  mageOccupantXInTile: ${fmt(s.mageOccupantXInTile)},
  mageRoofInSprite: [${s.mageRoofInSprite.map(fmt).join(", ")}],
  mageWallTopInSprite: [${s.mageWallTopInSprite.map(fmt).join(", ")}],
  arrowLengthInTile: ${fmt(s.arrowLengthInTile)},
  cannonProjSizeInTile: ${fmt(s.cannonProjSizeInTile)},
  mageProjSizeInTile: ${fmt(s.mageProjSizeInTile)},
  rockWidthInTile: ${fmt(s.rockWidthInTile)},
  bushWidthInTile: ${fmt(s.bushWidthInTile)},
  treeWidthInTile: ${fmt(s.treeWidthInTile)},
  obstacleFootInTile: ${fmt(s.obstacleFootInTile)},
  startWidthInTile: ${fmt(s.startWidthInTile)},
  startFootInTile: ${fmt(s.startFootInTile)},
  baseWidthInTile: ${fmt(s.baseWidthInTile)},
  baseFootInTile: ${fmt(s.baseFootInTile)},
  enemyWidthInTile: {
${enemyBlock(s.enemyWidthInTile)}
  },
  enemyAnchorY: {
${enemyBlock(s.enemyAnchorY)}
  },
  enemyFootInTile: {
${enemyBlock(s.enemyFootInTile)}
  },
  enemyXInTile: {
${enemyBlock(s.enemyXInTile)}
  },
  allyWidthInTile: ${fmt(s.allyWidthInTile)},
  allyAnchorY: ${fmt(s.allyAnchorY)},
  allyFootInTile: ${fmt(s.allyFootInTile)},
};`;
}

/** draw-grid가 생성 시 읽는 앵커. spriteLayout.enemyAnchorY와 같은 객체다. */
export const ENEMY_ANCHOR_Y = spriteLayout.enemyAnchorY;

export function archerDeckInSprite(level: number): number {
  const index = Math.min(spriteLayout.archerDeckInSprite.length, Math.max(1, level)) - 1;
  return spriteLayout.archerDeckInSprite[index]!;
}

export function archerRoofInSprite(level: number): number {
  const index = Math.min(spriteLayout.archerRoofInSprite.length, Math.max(1, level)) - 1;
  return spriteLayout.archerRoofInSprite[index] ?? 0;
}

export function archerWallTopInSprite(level: number): number {
  const index = Math.min(spriteLayout.archerWallTopInSprite.length, Math.max(1, level)) - 1;
  return spriteLayout.archerWallTopInSprite[index] ?? 0;
}

export function mageRoofInSprite(level: number): number {
  const index = Math.min(spriteLayout.mageRoofInSprite.length, Math.max(1, level)) - 1;
  return spriteLayout.mageRoofInSprite[index] ?? 0;
}

export function mageWallTopInSprite(level: number): number {
  const index = Math.min(spriteLayout.mageWallTopInSprite.length, Math.max(1, level)) - 1;
  return spriteLayout.mageWallTopInSprite[index] ?? 0;
}

export function towerRoofFromTop(typeId: TowerTypeId, level: number): number {
  if (typeId === "archer") {
    return archerRoofInSprite(level);
  }
  if (typeId === "mage") {
    return mageRoofInSprite(level);
  }
  return 0;
}

export function towerWallFromTop(typeId: TowerTypeId, level: number): number {
  if (typeId === "archer") {
    return archerWallTopInSprite(level);
  }
  if (typeId === "mage") {
    return mageWallTopInSprite(level);
  }
  return 0;
}

export function layoutTowerRoofSprite(
  roof: Sprite,
  towerSprite: AnimatedSprite,
  fromTop: number,
): void {
  if (fromTop <= 0) {
    roof.visible = false;
    return;
  }
  roof.visible = towerSprite.visible;
  roof.scale.copyFrom(towerSprite.scale);
  roof.anchor.set(0.5, 1);
  roof.position.set(
    towerSprite.x,
    towerSprite.y - towerSprite.height * (1 - fromTop),
  );
}

export function layoutTowerWallSprite(
  wall: Sprite,
  towerSprite: AnimatedSprite,
  wallTop: number,
): void {
  if (wallTop <= 0) {
    wall.visible = false;
    return;
  }
  wall.visible = towerSprite.visible;
  wall.scale.copyFrom(towerSprite.scale);
  wall.anchor.set(0.5, 0);
  wall.position.set(
    towerSprite.x,
    towerSprite.y - towerSprite.height * (1 - wallTop),
  );
}

export function obstacleWidthInTile(kind: ObstacleKind, texture: Texture): number {
  if (kind === "rock") {
    return spriteLayout.rockWidthInTile;
  }
  if (texture.height / Math.max(1, texture.width) >= 1.1) {
    return spriteLayout.treeWidthInTile;
  }
  return spriteLayout.bushWidthInTile;
}

export function layoutStartSprite(
  sprite: Sprite,
  layout: GridLayout,
  x: number,
  y: number,
): void {
  sprite.anchor.set(0.5, 1);
  const scale =
    (layout.tileSize * spriteLayout.startWidthInTile) / Math.max(1, sprite.texture.width);
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY +
      (y + 1) * layout.tileSize -
      layout.tileSize * spriteLayout.startFootInTile,
  );
  sprite.zIndex = y;
  sprite.visible = true;
}

export function layoutBaseSprite(
  sprite: Sprite,
  layout: GridLayout,
  x: number,
  y: number,
): void {
  sprite.anchor.set(0.5, 1);
  const scale =
    (layout.tileSize * spriteLayout.baseWidthInTile) / Math.max(1, sprite.texture.width);
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY +
      (y + 1) * layout.tileSize -
      layout.tileSize * spriteLayout.baseFootInTile,
  );
  sprite.zIndex = y;
  sprite.visible = true;
}

export function layoutObstacleSprite(
  sprite: Sprite,
  layout: GridLayout,
  obstacle: Obstacle,
  texture: Texture,
): void {
  sprite.texture = texture;
  sprite.anchor.set(0.5, 1);
  const widthInTile = obstacleWidthInTile(obstacle.kind, texture);
  const scale = (layout.tileSize * widthInTile) / Math.max(1, texture.width);
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (obstacle.x + 0.5) * layout.tileSize,
    layout.originY +
      (obstacle.y + 1) * layout.tileSize -
      layout.tileSize * spriteLayout.obstacleFootInTile,
  );
  sprite.zIndex = obstacle.y;
  sprite.visible = true;
}

export function layoutEnemySprite(
  sprite: AnimatedSprite,
  layout: GridLayout,
  unit: Pick<Unit, "x" | "y">,
  facing: 1 | -1,
  enemyType: EnemyTypeId | null,
): void {
  const widthInTile = enemyType
    ? spriteLayout.enemyWidthInTile[enemyType]
    : spriteLayout.allyWidthInTile;
  const footInTile = enemyType
    ? spriteLayout.enemyFootInTile[enemyType]
    : spriteLayout.allyFootInTile;
  const offsetX = enemyType ? spriteLayout.enemyXInTile[enemyType] : 0;
  const anchorY = enemyType
    ? spriteLayout.enemyAnchorY[enemyType]
    : spriteLayout.allyAnchorY;
  sprite.anchor.set(0.5, anchorY);
  const sizeScale = (layout.tileSize * widthInTile) / sprite.texture.width;
  sprite.scale.set(sizeScale * facing, sizeScale);
  sprite.position.set(
    layout.originX + (unit.x + 0.5 + offsetX) * layout.tileSize,
    layout.originY + (unit.y + footInTile) * layout.tileSize,
  );
  sprite.zIndex = unit.y;
}

export function layoutTowerSprite(
  sprite: AnimatedSprite,
  layout: GridLayout,
  x: number,
  y: number,
): void {
  const scale =
    (layout.tileSize * spriteLayout.towerWidthInTile) / sprite.texture.width;
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY +
      (y + 1) * layout.tileSize -
      layout.tileSize * spriteLayout.towerFootInTile,
  );
  sprite.zIndex = y;
}

export function layoutOccupantSprite(
  sprite: AnimatedSprite,
  towerSprite: AnimatedSprite,
  layout: GridLayout,
  y: number,
  facing: 1 | -1,
  tower: Tower,
): void {
  const widthInTile =
    tower.typeId === "cannon"
      ? spriteLayout.cannonWidthInTile
      : spriteLayout.occupantWidthInTile;
  const sizeScale = (layout.tileSize * widthInTile) / sprite.texture.width;
  sprite.scale.set(sizeScale * facing, sizeScale);
  const levelIndex = Math.min(
    spriteLayout.archerOccupantXInTile.length,
    Math.max(1, tower.level),
  ) - 1;
  if (tower.typeId === "cannon") {
    sprite.anchor.set(0.5, spriteLayout.occupantAnchorY);
    sprite.position.set(
      towerSprite.x + spriteLayout.cannonOccupantXInTile * layout.tileSize,
      towerSprite.y - towerSprite.height * spriteLayout.cannonDeckInSprite,
    );
  } else if (tower.typeId === "mage") {
    sprite.anchor.set(0.5, spriteLayout.occupantAnchorY);
    sprite.position.set(
      towerSprite.x + spriteLayout.mageOccupantXInTile * layout.tileSize,
      towerSprite.y - towerSprite.height * spriteLayout.mageDeckInSprite,
    );
  } else {
    sprite.anchor.set(0.5, spriteLayout.archerAnchorY);
    sprite.position.set(
      towerSprite.x +
        (spriteLayout.archerOccupantXInTile[levelIndex] ?? 0) * layout.tileSize,
      towerSprite.y - towerSprite.height * archerDeckInSprite(tower.level),
    );
  }
  sprite.zIndex = y + 0.2;
}

export function layoutCenteredSprite(
  sprite: Sprite,
  layout: GridLayout,
  x: number,
  y: number,
  sizeInTile: number,
): void {
  sprite.anchor.set(0.5);
  const long = Math.max(sprite.texture.width, sprite.texture.height);
  const scale = (layout.tileSize * sizeInTile) / Math.max(1, long);
  sprite.scale.set(scale);
  sprite.position.set(
    layout.originX + (x + 0.5) * layout.tileSize,
    layout.originY + (y + 0.5) * layout.tileSize,
  );
  sprite.visible = true;
}
