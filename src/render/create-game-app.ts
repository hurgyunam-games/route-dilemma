import { Application } from "pixi.js";

export async function createGameApp(host: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x141418,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  host.appendChild(app.canvas);
  return app;
}

export function destroyGameApp(app: Application): void {
  app.destroy(true, { children: true });
}
