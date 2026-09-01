/** Logical battle grid. Columns are N (width), rows are M (height). */

export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_GRID_ROWS = 8;
export const DEFAULT_VIEWPORT_PADDING = 24;

export type TileCoord = {
  readonly x: number;
  readonly y: number;
};

export type TileKind = "empty" | "start" | "base" | "tower";

export type Grid = {
  readonly cols: number;
  readonly rows: number;
  readonly start: TileCoord;
  readonly base: TileCoord;
  readonly towers: readonly TileCoord[];
};

export type GridLayout = {
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
};

export function createGrid(
  cols: number = DEFAULT_GRID_COLS,
  rows: number = DEFAULT_GRID_ROWS,
): Grid {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    throw new Error("Grid size must be positive integers");
  }
  const y = Math.floor((rows - 1) / 2);
  return {
    cols,
    rows,
    start: { x: 0, y },
    base: { x: cols - 1, y },
    towers: [],
  };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

export function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function hasTower(grid: Grid, x: number, y: number): boolean {
  return grid.towers.some((tower) => tower.x === x && tower.y === y);
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
  return "empty";
}

/** Place or remove a tower. Start / Base / out of bounds are no-ops. Path blocking is allowed. */
export function toggleTower(grid: Grid, x: number, y: number): Grid {
  if (!inBounds(grid, x, y)) {
    return grid;
  }
  if (sameTile(grid.start, { x, y }) || sameTile(grid.base, { x, y })) {
    return grid;
  }
  if (hasTower(grid, x, y)) {
    return {
      ...grid,
      towers: grid.towers.filter((tower) => tower.x !== x || tower.y !== y),
    };
  }
  return {
    ...grid,
    towers: [...grid.towers, { x, y }],
  };
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
