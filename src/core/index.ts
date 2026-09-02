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
  BASE_MAX_HP,
  CATCH_RANGE_TILES,
  createSim,
  ENEMY_BASE_DAMAGE,
  hudSnapshot,
  PHASE_DURATION_SEC,
  SPAWN_INTERVAL_SEC,
  setTimeScale,
  simToggleTower,
  tick,
  TIME_SCALES,
  TOWER_ATTACK_DPS,
  TOWER_RANGE_TILES,
  UNIT_ATTACK_DPS,
  UNIT_MAX_HP,
  unitTile,
  WAVE_SIZE,
  ENEMY_TYPE_IDS,
} from "./sim";
export type {
  EnemyTypeId,
  HudSnapshot,
  Phase,
  SimState,
  TimeScale,
  TowerShot,
  Unit,
  UnitKind,
} from "./sim";
