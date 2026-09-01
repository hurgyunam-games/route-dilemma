import { Assets, Texture } from "pixi.js";
import floorUrl from "@/render/assets/floor.png";

export async function loadFloorTexture(): Promise<Texture> {
  const texture = await Assets.load<Texture>(floorUrl);
  texture.source.style.scaleMode = "nearest";
  return texture;
}
