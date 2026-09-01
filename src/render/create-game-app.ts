import { Application } from "pixi.js";
import type { Grid } from "@/core";
import { createGridView } from "@/render/draw-grid";

const cleanups = new WeakMap<Application, () => void>();

export async function createGameApp(
  host: HTMLElement,
  grid: Grid,
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

  const gridView = createGridView();
  app.stage.addChild(gridView.container);

  const sync = (): void => {
    gridView.sync(grid, app.screen.width, app.screen.height);
  };
  sync();

  const onResize = (): void => {
    sync();
  };
  app.renderer.on("resize", onResize);
  cleanups.set(app, () => {
    app.renderer.off("resize", onResize);
  });

  return app;
}

export function destroyGameApp(app: Application): void {
  cleanups.get(app)?.();
  cleanups.delete(app);
  app.destroy(true, { children: true });
}
