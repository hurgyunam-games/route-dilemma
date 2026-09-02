import { Application, Rectangle, type FederatedPointerEvent } from "pixi.js";
import type { Grid, Unit } from "@/core";
import { loadAllyFrames } from "@/render/ally-sprites";
import { createGridView } from "@/render/draw-grid";
import { loadEnemyFrames } from "@/render/enemy-sprites";
import { loadFloorTexture } from "@/render/floor-tile";
import { loadTowerFrames } from "@/render/tower-sprites";

type GameSession = {
  cleanup: () => void;
  setView: (grid: Grid, units: readonly Unit[]) => void;
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

  const [towerFrames, floorTexture, enemySheets, allyWalk] = await Promise.all([
    loadTowerFrames(),
    loadFloorTexture(),
    loadEnemyFrames(),
    loadAllyFrames(),
  ]);
  const gridView = createGridView(towerFrames, floorTexture, enemySheets, allyWalk);
  app.stage.addChild(gridView.container);
  app.stage.eventMode = "static";
  app.stage.cursor = "pointer";

  let currentGrid = grid;
  let currentUnits = units;

  const syncHitArea = (): void => {
    app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  };

  const sync = (): void => {
    gridView.sync(currentGrid, app.screen.width, app.screen.height, currentUnits);
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
    setView: (nextGrid, nextUnits) => {
      currentGrid = nextGrid;
      currentUnits = nextUnits;
      sync();
    },
  });

  return app;
}

export function setGameView(app: Application, grid: Grid, units: readonly Unit[]): void {
  sessions.get(app)?.setView(grid, units);
}

export function destroyGameApp(app: Application): void {
  sessions.get(app)?.cleanup();
  sessions.delete(app);
  app.destroy(true, { children: true });
}
