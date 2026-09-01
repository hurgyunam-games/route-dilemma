/** Logical battle grid. Columns are N (width), rows are M (height). */

export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_GRID_ROWS = 8;
export const DEFAULT_VIEWPORT_PADDING = 24;

export type TileCoord = {
  readonly x: number;
  readonly y: number;
};

export type TileKind = "empty" | "start" | "base";

export type Grid = {
  readonly cols: number;
  readonly rows: number;
  readonly start: TileCoord;
  readonly base: TileCoord;
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
  };
}

export function tileKind(grid: Grid, x: number, y: number): TileKind {
  if (x === grid.start.x && y === grid.start.y) {
    return "start";
  }
  if (x === grid.base.x && y === grid.base.y) {
    return "base";
  }
  return "empty";
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
