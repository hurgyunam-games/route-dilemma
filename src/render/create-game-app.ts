import { Application, Rectangle, type FederatedPointerEvent } from "pixi.js";
import type { Grid, TowerShot, Unit } from "@/core";
import { loadAllyFrames } from "@/render/ally-sprites";
import { loadArrowFrames } from "@/render/arrow-sprites";
import { createGridView, type RangePreview } from "@/render/draw-grid";
import {
  loadCannonProjectileFrames,
  loadMageProjectileFrames,
} from "@/render/projectile-sprites";
import { loadEnemyFrames } from "@/render/enemy-sprites";
import { loadFloorTexture } from "@/render/floor-tile";
import { loadOccupantFrames } from "@/render/occupant-sprites";
import { loadObstacleFrames } from "@/render/obstacle-sprites";
import { loadTowerFrames } from "@/render/tower-sprites";

type GameSession = {
  cleanup: () => void;
  setView: (
    grid: Grid,
    units: readonly Unit[],
    towerShots?: readonly TowerShot[],
    rangePreview?: RangePreview | null,
  ) => void;
};

const sessions = new WeakMap<Application, GameSession>();

export async function createGameApp(
  host: HTMLElement,
  grid: Grid,
  units: readonly Unit[],
  onTileClick: (x: number, y: number) => void,
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
    enemySheets,
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
  const gridView = createGridView(
    towerAtlas,
    occupantAtlas,
    floorTexture,
    enemySheets,
    allyWalk,
    arrowFrames,
    cannonProjFrames,
    mageProjFrames,
    obstacleAtlas,
  );
  app.stage.addChild(gridView.container);
  app.stage.eventMode = "static";
  app.stage.cursor = "pointer";

  let currentGrid = grid;
  let currentUnits = units;
  let currentShots: readonly TowerShot[] = [];
  let currentPreview: RangePreview | null = null;

  const syncHitArea = (): void => {
    app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  };

  const sync = (): void => {
    gridView.sync(
      currentGrid,
      app.screen.width,
      app.screen.height,
      currentUnits,
      currentShots,
      currentPreview,
    );
    syncHitArea();
  };
  sync();

  const onPointerTap = (event: FederatedPointerEvent): void => {
    const tile = gridView.tileAt(event.global.x, event.global.y);
    if (!tile) {
      return;
    }
    onTileClick(tile.x, tile.y);
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
    setView: (nextGrid, nextUnits, nextShots = [], nextPreview = null) => {
      currentGrid = nextGrid;
      currentUnits = nextUnits;
      currentShots = nextShots;
      currentPreview = nextPreview;
      sync();
    },
  });

  return app;
}

export function setGameView(
  app: Application,
  grid: Grid,
  units: readonly Unit[],
  towerShots: readonly TowerShot[] = [],
  rangePreview: RangePreview | null = null,
): void {
  sessions.get(app)?.setView(grid, units, towerShots, rangePreview);
}

export function destroyGameApp(app: Application): void {
  sessions.get(app)?.cleanup();
  sessions.delete(app);
  app.destroy(true, { children: true });
}
