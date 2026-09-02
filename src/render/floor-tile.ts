import type { Texture } from "pixi.js";
import { loadLocalTexture } from "@/render/local-image";

export async function loadFloorTexture(): Promise<Texture> {
  return loadLocalTexture("floor.png", "#3a4638", 32, 32);
}
