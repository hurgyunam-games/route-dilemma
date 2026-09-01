/** Headless game simulation. Do not import vue, pinia, or pixi.js from this folder. */
export {
  createGrid,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_VIEWPORT_PADDING,
  fitGridToViewport,
  forEachTile,
  hasTower,
  inBounds,
  sameTile,
  tileKind,
  toggleTower,
  viewportToTile,
} from "./grid";
export type { Grid, GridLayout, TileCoord, TileKind } from "./grid";
