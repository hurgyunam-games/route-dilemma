/** Headless game simulation. Do not import vue, pinia, or pixi.js from this folder. */
export {
  createGrid,
  damageTower,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_VIEWPORT_PADDING,
  fitGridToViewport,
  forEachTile,
  getTower,
  hasTower,
  inBounds,
  sameTile,
  tileKind,
  toggleTower,
  TOWER_MAX_HP,
  viewportToTile,
} from "./grid";
export type { Grid, GridLayout, TileCoord, TileKind, Tower } from "./grid";
export { findPath, isWalkable } from "./path";
export type { Path } from "./path";
export {
  ALLY_GOLD_REWARD,
  createSim,
  hudSnapshot,
  PHASE_DURATION_SEC,
  setTimeScale,
  simToggleTower,
  tick,
  TIME_SCALES,
  UNIT_ATTACK_DPS,
  unitTile,
} from "./sim";
export type { HudSnapshot, Phase, SimState, TimeScale, Unit, UnitKind } from "./sim";
