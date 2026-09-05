import type { Texture } from "pixi.js";
import type { TowerTypeId } from "@/core";
import { loadLocalSheet, paintTexture } from "@/render/local-image";

export const OCCUPANT_FRAME_SIZE = 48;

export type OccupantSheets = {
  readonly idle: Texture[];
  readonly attack: Texture[];
  readonly preattack: Texture[];
};

export type OccupantAtlas = Record<TowerTypeId, readonly OccupantSheets[]>;

type OccupantFiles = {
  readonly idle: string;
  readonly attack: string;
  readonly idleCols: number;
  readonly attackCols: number;
  readonly fallback: [string, string];
};

const OCCUPANT_FILES: Record<TowerTypeId, readonly OccupantFiles[]> = {
  archer: [
    {
      idle: "occupant-archer-idle.png",
      attack: "occupant-archer-attack.png",
      idleCols: 4,
      attackCols: 6,
      fallback: ["#3a8b3a", "#2a6b2a"],
    },
  ],
  cannon: [
    {
      idle: "occupant-cannon-idle.png",
      attack: "occupant-cannon-attack.png",
      idleCols: 6,
      attackCols: 6,
      fallback: ["#8a4a28", "#c45a38"],
    },
  ],
  mage: [
    {
      idle: "occupant-mage-1-idle.png",
      attack: "occupant-mage-1-attack.png",
      idleCols: 4,
      attackCols: 6,
      fallback: ["#4a5aaa", "#6a4aaa"],
    },
    {
      idle: "occupant-mage-2-idle.png",
      attack: "occupant-mage-2-attack.png",
      idleCols: 4,
      attackCols: 6,
      fallback: ["#5a4aaa", "#7a5aba"],
    },
    {
      idle: "occupant-mage-3-idle.png",
      attack: "occupant-mage-3-attack.png",
      idleCols: 4,
      attackCols: 6,
      fallback: ["#3a3a8a", "#8a6acc"],
    },
  ],
  wall: [],
};

function blankOccupant(): OccupantSheets {
  const blank = paintTexture(OCCUPANT_FRAME_SIZE, OCCUPANT_FRAME_SIZE, () => {});
  return { idle: [blank], attack: [blank], preattack: [blank] };
}

async function loadOccupantVariant(files: OccupantFiles): Promise<OccupantSheets> {
  const [idle, attack] = await Promise.all([
    loadLocalSheet(
      files.idle,
      files.idleCols,
      1,
      files.fallback[0],
      OCCUPANT_FRAME_SIZE,
      OCCUPANT_FRAME_SIZE,
    ),
    loadLocalSheet(
      files.attack,
      files.attackCols,
      1,
      files.fallback[1],
      OCCUPANT_FRAME_SIZE,
      OCCUPANT_FRAME_SIZE,
    ),
  ]);
  return { idle, attack, preattack: idle.slice(0, 1) };
}

export async function loadOccupantFrames(): Promise<OccupantAtlas> {
  const [archer, cannon, mage] = await Promise.all([
    Promise.all(OCCUPANT_FILES.archer.map(loadOccupantVariant)),
    Promise.all(OCCUPANT_FILES.cannon.map(loadOccupantVariant)),
    Promise.all(OCCUPANT_FILES.mage.map(loadOccupantVariant)),
  ]);
  return { archer, cannon, mage, wall: [blankOccupant()] };
}

export function occupantVariantIndex(level: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return Math.min(count, Math.max(1, level)) - 1;
}

export function occupantClipFrames(
  atlas: OccupantAtlas,
  typeId: TowerTypeId,
  clip: keyof OccupantSheets,
  level = 1,
): Texture[] {
  const variants = atlas[typeId];
  const index = occupantVariantIndex(level, variants.length);
  return variants[index]![clip];
}
