import type { MapId } from "@/core";

/** xDeviruchi loops. Local files; gitignored with other licensed audio. */
export const WORLD_BGM_FILE = "bgm-port-town.ogg";
export const DEFAULT_BATTLE_BGM_FILE = "bgm-definitely-our-town.ogg";

const BATTLE_BGM_BY_MAP: Partial<Record<MapId, string>> = {
  2: "bgm-shop.ogg",
  3: "bgm-mighty-kingdom.ogg",
  4: "bgm-frozen-abyss.ogg",
  5: "bgm-decisive-battle.ogg",
};

export function battleBgmFile(mapId: MapId): string {
  return BATTLE_BGM_BY_MAP[mapId] ?? DEFAULT_BATTLE_BGM_FILE;
}
