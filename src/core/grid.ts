/** Logical battle grid. Columns are N (width), rows are M (height). */

import {
  BUILD_DURATION_SEC,
  DEFAULT_TOWER_TYPE,
  TOWER_MAX_HP,
  TOWER_MAX_LEVEL,
  UPGRADE_DURATION_SEC,
  isTowerComplete,
  towerMaxHp,
  type TowerTypeId,
} from "./towers";

export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_GRID_ROWS = 8;
export const DEFAULT_VIEWPORT_PADDING = 24;
export { TOWER_MAX_HP };

export const OBSTACLE_KINDS = ["rock", "tree"] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

/** Both kinds sit above every level-1 tower HP (archer/wall 8, cannon 10). */
export const OBSTACLE_MAX_HP: Record<ObstacleKind, number> = {
  tree: 16,
  rock: 20,
};

export function obstacleMaxHp(kind: ObstacleKind): number {
  return OBSTACLE_MAX_HP[kind];
}

export type TileCoord = {
  readonly x: number;
  readonly y: number;
};

export type Tower = {
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly typeId: TowerTypeId;
  readonly level: number;
  readonly buildTimeLeft: number;
};

export type ObstacleDef = {
  readonly x: number;
  readonly y: number;
  readonly kind: ObstacleKind;
};

export type Obstacle = ObstacleDef & {
  readonly hp: number;
};

export type TileKind = "empty" | "start" | "base" | "tower" | "obstacle";

export type Grid = {
  readonly cols: number;
  readonly rows: number;
  readonly start: TileCoord;
  readonly base: TileCoord;
  readonly towers: readonly Tower[];
  readonly obstacles: readonly Obstacle[];
};

export type GridLayout = {
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
};

function isInside(cols: number, rows: number, tile: TileCoord): boolean {
  return (
    Number.isInteger(tile.x) &&
    Number.isInteger(tile.y) &&
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x < cols &&
    tile.y < rows
  );
}

export function createGrid(
  cols: number = DEFAULT_GRID_COLS,
  rows: number = DEFAULT_GRID_ROWS,
  start?: TileCoord,
  base?: TileCoord,
  obstacleDefs: readonly ObstacleDef[] = [],
): Grid {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    throw new Error("Grid size must be positive integers");
  }
  const y = Math.floor((rows - 1) / 2);
  const resolvedStart = start ?? { x: 0, y };
  const resolvedBase = base ?? { x: cols - 1, y };
  if (!isInside(cols, rows, resolvedStart) || !isInside(cols, rows, resolvedBase)) {
    throw new Error("Start and Base must be inside the grid");
  }
  if (resolvedStart.x === resolvedBase.x && resolvedStart.y === resolvedBase.y) {
    throw new Error("Start and Base must be different tiles");
  }
  return {
    cols,
    rows,
    start: resolvedStart,
    base: resolvedBase,
    towers: [],
    obstacles: makeObstacles(cols, rows, resolvedStart, resolvedBase, obstacleDefs),
  };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

export function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function getTower(grid: Grid, x: number, y: number): Tower | undefined {
  return grid.towers.find((tower) => tower.x === x && tower.y === y);
}

export function hasTower(grid: Grid, x: number, y: number): boolean {
  return getTower(grid, x, y) !== undefined;
}

export function getObstacle(grid: Grid, x: number, y: number): Obstacle | undefined {
  return grid.obstacles.find((obstacle) => obstacle.x === x && obstacle.y === y);
}

export function hasObstacle(grid: Grid, x: number, y: number): boolean {
  return getObstacle(grid, x, y) !== undefined;
}

export function isBlocked(grid: Grid, x: number, y: number): boolean {
  return hasTower(grid, x, y) || hasObstacle(grid, x, y);
}

/** Reduce tower HP. At 0 or below the tower is removed. */
export function damageTower(grid: Grid, x: number, y: number, amount: number): Grid {
  const tower = getTower(grid, x, y);
  if (!tower || !(amount > 0)) {
    return grid;
  }
  const hp = tower.hp - amount;
  if (hp <= 0) {
    return {
      ...grid,
      towers: grid.towers.filter((entry) => entry.x !== x || entry.y !== y),
    };
  }
  return {
    ...grid,
    towers: grid.towers.map((entry) =>
      entry.x === x && entry.y === y ? { ...entry, hp } : entry,
    ),
  };
}

/** Reduce obstacle HP. At 0 or below the obstacle is removed. */
export function damageObstacle(grid: Grid, x: number, y: number, amount: number): Grid {
  const obstacle = getObstacle(grid, x, y);
  if (!obstacle || !(amount > 0)) {
    return grid;
  }
  const hp = obstacle.hp - amount;
  if (hp <= 0) {
    return {
      ...grid,
      obstacles: grid.obstacles.filter((entry) => entry.x !== x || entry.y !== y),
    };
  }
  return {
    ...grid,
    obstacles: grid.obstacles.map((entry) =>
      entry.x === x && entry.y === y ? { ...entry, hp } : entry,
    ),
  };
}

/** Hit a tower or natural obstacle on this tile. */
export function damageBlocker(grid: Grid, x: number, y: number, amount: number): Grid {
  if (hasTower(grid, x, y)) {
    return damageTower(grid, x, y, amount);
  }
  return damageObstacle(grid, x, y, amount);
}

export function tileKind(grid: Grid, x: number, y: number): TileKind {
  if (x === grid.start.x && y === grid.start.y) {
    return "start";
  }
  if (x === grid.base.x && y === grid.base.y) {
    return "base";
  }
  if (hasTower(grid, x, y)) {
    return "tower";
  }
  if (hasObstacle(grid, x, y)) {
    return "obstacle";
  }
  return "empty";
}

function canOccupy(grid: Grid, x: number, y: number): boolean {
  return (
    inBounds(grid, x, y) &&
    !sameTile(grid.start, { x, y }) &&
    !sameTile(grid.base, { x, y }) &&
    !hasObstacle(grid, x, y)
  );
}

function makeObstacles(
  cols: number,
  rows: number,
  start: TileCoord,
  base: TileCoord,
  defs: readonly ObstacleDef[],
): Obstacle[] {
  const seen = new Set<string>();
  const obstacles: Obstacle[] = [];
  for (const def of defs) {
    if (!isInside(cols, rows, def)) {
      throw new Error("Obstacles must be inside the grid");
    }
    if (sameTile(def, start) || sameTile(def, base)) {
      throw new Error("Obstacles cannot sit on Start or Base");
    }
    const key = `${def.x},${def.y}`;
    if (seen.has(key)) {
      throw new Error("Obstacles cannot overlap");
    }
    seen.add(key);
    obstacles.push({
      x: def.x,
      y: def.y,
      kind: def.kind,
      hp: obstacleMaxHp(def.kind),
    });
  }
  return obstacles;
}

function makeTower(
  x: number,
  y: number,
  typeId: TowerTypeId,
  level: number,
  buildTimeLeft: number,
): Tower {
  return {
    x,
    y,
    typeId,
    level,
    buildTimeLeft,
    hp: towerMaxHp({ typeId, level }),
  };
}

/** Restore saved towers onto a fresh map. Invalid tiles are skipped. */
export function withTowers(grid: Grid, towers: readonly Tower[]): Grid {
  const next: Tower[] = [];
  const seen = new Set<string>();
  for (const tower of towers) {
    const key = `${tower.x},${tower.y}`;
    if (seen.has(key) || !canOccupy(grid, tower.x, tower.y)) {
      continue;
    }
    seen.add(key);
    next.push({
      x: tower.x,
      y: tower.y,
      hp: tower.hp,
      typeId: tower.typeId,
      level: tower.level,
      buildTimeLeft: tower.buildTimeLeft,
    });
  }
  if (next.length === 0 && grid.towers.length === 0) {
    return grid;
  }
  return { ...grid, towers: next };
}

/** Place a tower. Start / Base / occupied / out of bounds are no-ops. Path blocking is allowed. */
export function placeTower(
  grid: Grid,
  x: number,
  y: number,
  typeId: TowerTypeId,
  buildTimeLeft: number = BUILD_DURATION_SEC,
): Grid {
  if (!canOccupy(grid, x, y) || hasTower(grid, x, y)) {
    return grid;
  }
  return {
    ...grid,
    towers: [...grid.towers, makeTower(x, y, typeId, 1, buildTimeLeft)],
  };
}

/** Raise a finished tower by one level. Incomplete / max-level / missing are no-ops. */
export function upgradeTower(grid: Grid, x: number, y: number): Grid {
  const tower = getTower(grid, x, y);
  if (!tower || !isTowerComplete(tower) || tower.level >= TOWER_MAX_LEVEL) {
    return grid;
  }
  const level = tower.level + 1;
  const next: Tower = {
    ...tower,
    level,
    hp: towerMaxHp({ typeId: tower.typeId, level }),
    buildTimeLeft: UPGRADE_DURATION_SEC,
  };
  return {
    ...grid,
    towers: grid.towers.map((entry) =>
      entry.x === x && entry.y === y ? next : entry,
    ),
  };
}

/** Count down construction. Finished towers are unchanged. */
export function advanceTowerBuilds(grid: Grid, dt: number): Grid {
  if (!(dt > 0) || !grid.towers.some((tower) => tower.buildTimeLeft > 0)) {
    return grid;
  }
  return {
    ...grid,
    towers: grid.towers.map((tower) =>
      tower.buildTimeLeft > 0
        ? { ...tower, buildTimeLeft: Math.max(0, tower.buildTimeLeft - dt) }
        : tower,
    ),
  };
}

/** Remove a tower. Missing tiles are no-ops. */
export function removeTower(grid: Grid, x: number, y: number): Grid {
  if (!hasTower(grid, x, y)) {
    return grid;
  }
  return {
    ...grid,
    towers: grid.towers.filter((tower) => tower.x !== x || tower.y !== y),
  };
}

/** Place or remove a finished default tower. Start / Base / out of bounds are no-ops. Path blocking is allowed. */
export function toggleTower(grid: Grid, x: number, y: number): Grid {
  if (!canOccupy(grid, x, y)) {
    return grid;
  }
  if (hasTower(grid, x, y)) {
    return removeTower(grid, x, y);
  }
  return placeTower(grid, x, y, DEFAULT_TOWER_TYPE, 0);
}

export function forEachTile(
  grid: Grid,
  visit: (x: number, y: number) => void,
): void {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      visit(x, y);
    }
  }
}

/** Square tiles, centered, with padding so the full map stays on-screen. */
export function fitGridToViewport(
  grid: Grid,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = DEFAULT_VIEWPORT_PADDING,
): GridLayout {
  const innerWidth = Math.max(0, viewportWidth - padding * 2);
  const innerHeight = Math.max(0, viewportHeight - padding * 2);
  const tileSize = Math.max(
    0,
    Math.floor(Math.min(innerWidth / grid.cols, innerHeight / grid.rows)),
  );
  const width = tileSize * grid.cols;
  const height = tileSize * grid.rows;
  return {
    tileSize,
    originX: Math.floor((viewportWidth - width) / 2),
    originY: Math.floor((viewportHeight - height) / 2),
    width,
    height,
  };
}

/** Map a viewport pixel to a tile, or null if it misses the grid. */
export function viewportToTile(
  layout: GridLayout,
  px: number,
  py: number,
): TileCoord | null {
  if (layout.tileSize <= 0) {
    return null;
  }
  const localX = px - layout.originX;
  const localY = py - layout.originY;
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= layout.width ||
    localY >= layout.height
  ) {
    return null;
  }
  return {
    x: Math.floor(localX / layout.tileSize),
    y: Math.floor(localY / layout.tileSize),
  };
}
