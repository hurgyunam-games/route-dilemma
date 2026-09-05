import type { Texture } from "pixi.js";
import { type TowerTypeId } from "@/core";
import { loadLocalSheet } from "@/render/local-image";

/** Frame cell shared by all tower idle / build / upgrade strips. */
export const TOWER_FRAME_WIDTH = 70;
export const TOWER_FRAME_HEIGHT = 130;

export type TowerAtlas = {
  readonly build: Texture[];
  readonly byLevel: readonly Texture[][];
  readonly upgrade: readonly Texture[][];
};

export type TowerAtlasMap = Record<TowerTypeId, TowerAtlas>;

type SheetSpec = {
  readonly file: string;
  readonly cols: number;
  readonly fallback: string;
};

const SHARED_BUILD: readonly SheetSpec[] = [
  { file: "tower-build-1.png", cols: 4, fallback: "#5a4a38" },
  { file: "tower-build-2.png", cols: 4, fallback: "#6b5a4a" },
  { file: "tower-build-3.png", cols: 4, fallback: "#7a6a4a" },
];

const SHARED_LEVEL: readonly SheetSpec[] = [
  { file: "tower-lv1.png", cols: 4, fallback: "#8a6a48" },
  { file: "tower-lv2.png", cols: 6, fallback: "#6a8a48" },
  { file: "tower-lv3.png", cols: 6, fallback: "#6a7a8a" },
  { file: "tower-lv4.png", cols: 6, fallback: "#5a6a9a" },
  { file: "tower-lv5.png", cols: 6, fallback: "#4a8a6a" },
];

const SHARED_UPGRADE: readonly SheetSpec[] = [
  { file: "tower-up2.png", cols: 4, fallback: "#8a7a48" },
  { file: "tower-up3.png", cols: 4, fallback: "#6a7a68" },
  { file: "tower-up4.png", cols: 4, fallback: "#5a6a8a" },
  { file: "tower-up5.png", cols: 4, fallback: "#4a7a6a" },
];

async function loadSheet(spec: SheetSpec): Promise<Texture[]> {
  return loadLocalSheet(
    spec.file,
    spec.cols,
    1,
    spec.fallback,
    TOWER_FRAME_WIDTH,
    TOWER_FRAME_HEIGHT,
  );
}

function framesFrom(
  atlas: TowerAtlas,
  complete: boolean,
  level: number,
): Texture[] {
  if (!complete) {
    if (level <= 1) {
      return atlas.build;
    }
    return atlas.upgrade[level - 2] ?? atlas.build;
  }
  const index = Math.min(atlas.byLevel.length, Math.max(1, level)) - 1;
  return atlas.byLevel[index] ?? atlas.build;
}

async function loadSharedAtlas(): Promise<TowerAtlas> {
  const [buildParts, byLevel, upgrade] = await Promise.all([
    Promise.all(SHARED_BUILD.map(loadSheet)),
    Promise.all(SHARED_LEVEL.map(loadSheet)),
    Promise.all(SHARED_UPGRADE.map(loadSheet)),
  ]);
  return {
    build: buildParts.flat(),
    byLevel,
    upgrade,
  };
}

async function loadCannonAtlas(): Promise<TowerAtlas> {
  const [keep, lv5, up5] = await Promise.all([
    loadSheet({ file: "cannon-bases-keep.png", cols: 4, fallback: "#5a6a9a" }),
    loadSheet({ file: "cannon-lv5.png", cols: 6, fallback: "#4a8a6a" }),
    loadSheet({ file: "cannon-up5.png", cols: 4, fallback: "#4a7a6a" }),
  ]);
  const keepComplete = lv5.length > 0 ? lv5 : keep;
  return {
    build: keep,
    byLevel: [keepComplete, keepComplete, keepComplete, keepComplete, keepComplete],
    upgrade: [up5, up5, up5, up5],
  };
}

async function loadMageAtlas(): Promise<TowerAtlas> {
  const [lv1, lv2, lv3, lv4] = await Promise.all([
    loadSheet({ file: "mage-lv1.png", cols: 4, fallback: "#4a5aaa" }),
    loadSheet({ file: "mage-lv2.png", cols: 4, fallback: "#5a4aaa" }),
    loadSheet({ file: "mage-lv3.png", cols: 4, fallback: "#6a4aaa" }),
    loadSheet({ file: "mage-lv4.png", cols: 4, fallback: "#3a3a8a" }),
  ]);
  return {
    build: lv1,
    byLevel: [lv1, lv2, lv3, lv4, lv4],
    upgrade: [lv2, lv3, lv4, lv4],
  };
}

/** Empty keep: archer lv3/lv4/lv5, no occupant. Wall 1–2 / 3–4 / 5. */
function wallAtlasFromShared(shared: TowerAtlas): TowerAtlas {
  const lv3 = shared.byLevel[2] ?? shared.build;
  const lv4 = shared.byLevel[3] ?? lv3;
  const lv5 = shared.byLevel[4] ?? lv4;
  const up4 = shared.upgrade[2] ?? lv4;
  const up5 = shared.upgrade[3] ?? lv5;
  return {
    build: shared.build,
    byLevel: [lv3, lv3, lv4, lv4, lv5],
    upgrade: [lv3, up4, up4, up5],
  };
}

export async function loadTowerFrames(): Promise<TowerAtlasMap> {
  const [shared, cannon, mage] = await Promise.all([
    loadSharedAtlas(),
    loadCannonAtlas(),
    loadMageAtlas(),
  ]);
  return {
    archer: shared,
    cannon,
    mage,
    wall: wallAtlasFromShared(shared),
  };
}

export function towerVisualFrames(
  atlases: TowerAtlasMap,
  typeId: TowerTypeId,
  complete: boolean,
  level: number,
): Texture[] {
  return framesFrom(atlases[typeId], complete, level);
}
