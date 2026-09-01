import { Application, Rectangle, type FederatedPointerEvent } from "pixi.js";
import type { Grid } from "@/core";
import { createGridView } from "@/render/draw-grid";
import { loadTowerFrames } from "@/render/tower-sprites";

type GameSession = {
  cleanup: () => void;
  setGrid: (grid: Grid) => void;
};

const sessions = new WeakMap<Application, GameSession>();

export async function createGameApp(
  host: HTMLElement,
  grid: Grid,
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

  const towerFrames = await loadTowerFrames();
  const gridView = createGridView(towerFrames);
  app.stage.addChild(gridView.container);
  app.stage.eventMode = "static";
  app.stage.cursor = "pointer";

  let currentGrid = grid;

  const syncHitArea = (): void => {
    app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  };

  const sync = (): void => {
    gridView.sync(currentGrid, app.screen.width, app.screen.height);
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
    setGrid: (nextGrid: Grid) => {
      currentGrid = nextGrid;
      sync();
    },
  });

  return app;
}

export function setGameGrid(app: Application, grid: Grid): void {
  sessions.get(app)?.setGrid(grid);
}

export function destroyGameApp(app: Application): void {
  sessions.get(app)?.cleanup();
  sessions.delete(app);
  app.destroy(true, { children: true });
}
