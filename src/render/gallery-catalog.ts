import {
  ENEMY_TYPE_IDS,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  TOWER_TYPE_IDS,
  type EnemyTypeId,
  type ObstacleKind,
  type TowerTypeId,
} from "@/core";
import {
  ROCK_VARIANT_COUNT,
  TREE_VARIANT_COUNT,
} from "@/render/obstacle-sprites";
import { PROJECTILE_VARIANT_COUNT } from "@/render/projectile-sprites";
import { roundLayoutValue, spriteLayout } from "@/render/sprite-layout";

export const GALLERY_GROUPS = [
  "tower",
  "enemy",
  "ally",
  "obstacle",
  "projectile",
  "marker",
] as const;

export type GalleryGroup = (typeof GALLERY_GROUPS)[number];

export const GALLERY_GROUP_LABELS: Record<GalleryGroup, string> = {
  tower: "타워",
  enemy: "적",
  ally: "아군",
  obstacle: "지형",
  projectile: "투사체",
  marker: "칸 표시",
};

export const ENEMY_LABELS: Record<EnemyTypeId, string> = {
  beast: "비스트",
  cavalry: "기병",
  wolf: "늑대",
  slime: "슬라임",
  goblin: "고블린",
};

export type GalleryItem =
  | {
      readonly id: string;
      readonly group: "tower";
      readonly label: string;
      readonly typeId: TowerTypeId;
      readonly level: number;
      readonly hasOccupant: boolean;
    }
  | {
      readonly id: string;
      readonly group: "enemy";
      readonly label: string;
      readonly enemyType: EnemyTypeId;
    }
  | {
      readonly id: string;
      readonly group: "ally";
      readonly label: string;
    }
  | {
      readonly id: string;
      readonly group: "obstacle";
      readonly label: string;
      readonly obstacleKind: ObstacleKind;
      readonly variant: number;
    }
  | {
      readonly id: string;
      readonly group: "projectile";
      readonly label: string;
      readonly projectile: "arrow" | "cannon" | "mage";
      readonly variant: number;
    }
  | {
      readonly id: string;
      readonly group: "marker";
      readonly label: string;
      readonly marker: "start" | "base";
    };

export function itemHasOccupant(item: GalleryItem): boolean {
  return item.group === "tower" && item.hasOccupant;
}

export type LayoutKnob = {
  readonly id: string;
  readonly source: string;
  readonly label: string;
  readonly hint: string;
  readonly axis: "x" | "y";
  /** 값을 키우면 화면에서 위(+y) 또는 오른쪽(+x)으로 가는지. */
  readonly screenSign: 1 | -1;
  get(): number;
  set(value: number): void;
};

function knob(
  partial: Omit<LayoutKnob, "get" | "set"> & {
    get: () => number;
    set: (value: number) => void;
  },
): LayoutKnob {
  return {
    ...partial,
    get: partial.get,
    set: (value) => {
      partial.set(roundLayoutValue(value));
    },
  };
}

export function knobsForItem(item: GalleryItem): LayoutKnob[] {
  if (item.group === "tower") {
    const levelIndex = item.level - 1;
    const shared: LayoutKnob[] = [
      knob({
        id: "towerFoot",
        source: "towerFootInTile",
        label: "성벽 바닥",
        hint: "모든 타워 공통. 클수록 위로.",
        axis: "y",
        screenSign: 1,
        get: () => spriteLayout.towerFootInTile,
        set: (value) => {
          spriteLayout.towerFootInTile = value;
        },
      }),
      knob({
        id: "towerWidth",
        source: "towerWidthInTile",
        label: "성벽 크기",
        hint: "모든 타워 공통.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout.towerWidthInTile,
        set: (value) => {
          spriteLayout.towerWidthInTile = value;
        },
      }),
    ];
    if (item.typeId === "archer") {
      return [
        knob({
          id: "archerDeck",
          source: `archerDeckInSprite[${levelIndex}]`,
          label: "궁수 발 높이",
          hint: "클수록 위로. Lv별 값.",
          axis: "y",
          screenSign: 1,
          get: () => spriteLayout.archerDeckInSprite[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.archerDeckInSprite[levelIndex] = value;
          },
        }),
        knob({
          id: "archerRoof",
          source: `archerRoofInSprite[${levelIndex}]`,
          label: "지붕",
          hint: "클수록 아래로 덮음. 나무 바닥은 넣지 않음.",
          axis: "y",
          screenSign: -1,
          get: () => spriteLayout.archerRoofInSprite[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.archerRoofInSprite[levelIndex] = value;
          },
        }),
        knob({
          id: "archerWallTop",
          source: `archerWallTopInSprite[${levelIndex}]`,
          label: "앞벽 위치",
          hint: "클수록 아래로. 여기부터 맨 아래까지 유닛 앞.",
          axis: "y",
          screenSign: -1,
          get: () => spriteLayout.archerWallTopInSprite[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.archerWallTopInSprite[levelIndex] = value;
          },
        }),
        knob({
          id: "archerX",
          source: `archerOccupantXInTile[${levelIndex}]`,
          label: "궁수 좌우",
          hint: "클수록 오른쪽. Lv별 값.",
          axis: "x",
          screenSign: 1,
          get: () => spriteLayout.archerOccupantXInTile[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.archerOccupantXInTile[levelIndex] = value;
          },
        }),
        ...shared,
      ];
    }
    if (item.typeId === "cannon") {
      return [
        knob({
          id: "cannonDeck",
          source: "cannonDeckInSprite",
          label: "대포 높이",
          hint: "전 레벨 공통. 클수록 위로.",
          axis: "y",
          screenSign: 1,
          get: () => spriteLayout.cannonDeckInSprite,
          set: (value) => {
            spriteLayout.cannonDeckInSprite = value;
          },
        }),
        knob({
          id: "cannonX",
          source: "cannonOccupantXInTile",
          label: "대포 좌우",
          hint: "전 레벨 공통. 클수록 오른쪽.",
          axis: "x",
          screenSign: 1,
          get: () => spriteLayout.cannonOccupantXInTile,
          set: (value) => {
            spriteLayout.cannonOccupantXInTile = value;
          },
        }),
        ...shared,
      ];
    }
    if (item.typeId === "mage") {
      return [
        knob({
          id: "mageDeck",
          source: "mageDeckInSprite",
          label: "마법사 높이",
          hint: "전 레벨 공통. 클수록 위로.",
          axis: "y",
          screenSign: 1,
          get: () => spriteLayout.mageDeckInSprite,
          set: (value) => {
            spriteLayout.mageDeckInSprite = value;
          },
        }),
        knob({
          id: "mageRoof",
          source: `mageRoofInSprite[${levelIndex}]`,
          label: "지붕·수정",
          hint: "클수록 아래로 덮음. 나무 바닥은 넣지 않음. Lv별 값.",
          axis: "y",
          screenSign: -1,
          get: () => spriteLayout.mageRoofInSprite[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.mageRoofInSprite[levelIndex] = value;
          },
        }),
        knob({
          id: "mageWallTop",
          source: `mageWallTopInSprite[${levelIndex}]`,
          label: "앞벽 위치",
          hint: "클수록 아래로. 여기부터 맨 아래까지 유닛 앞. Lv별 값.",
          axis: "y",
          screenSign: -1,
          get: () => spriteLayout.mageWallTopInSprite[levelIndex] ?? 0,
          set: (value) => {
            spriteLayout.mageWallTopInSprite[levelIndex] = value;
          },
        }),
        knob({
          id: "mageX",
          source: "mageOccupantXInTile",
          label: "마법사 좌우",
          hint: "전 레벨 공통. 클수록 오른쪽.",
          axis: "x",
          screenSign: 1,
          get: () => spriteLayout.mageOccupantXInTile,
          set: (value) => {
            spriteLayout.mageOccupantXInTile = value;
          },
        }),
        ...shared,
      ];
    }
    return shared;
  }
  if (item.group === "enemy") {
    const type = item.enemyType;
    return [
      knob({
        id: "enemyX",
        source: `enemyXInTile.${type}`,
        label: "좌우",
        hint: "클수록 오른쪽.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout.enemyXInTile[type],
        set: (value) => {
          spriteLayout.enemyXInTile[type] = value;
        },
      }),
      knob({
        id: "enemyFoot",
        source: `enemyFootInTile.${type}`,
        label: "발 위치",
        hint: "클수록 아래로.",
        axis: "y",
        screenSign: -1,
        get: () => spriteLayout.enemyFootInTile[type],
        set: (value) => {
          spriteLayout.enemyFootInTile[type] = value;
        },
      }),
      knob({
        id: "enemyWidth",
        source: `enemyWidthInTile.${type}`,
        label: "크기",
        hint: "타일 대비 너비.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout.enemyWidthInTile[type],
        set: (value) => {
          spriteLayout.enemyWidthInTile[type] = value;
        },
      }),
    ];
  }
  if (item.group === "ally") {
    return [
      knob({
        id: "allyFoot",
        source: "allyFootInTile",
        label: "발 위치",
        hint: "클수록 아래로.",
        axis: "y",
        screenSign: -1,
        get: () => spriteLayout.allyFootInTile,
        set: (value) => {
          spriteLayout.allyFootInTile = value;
        },
      }),
      knob({
        id: "allyWidth",
        source: "allyWidthInTile",
        label: "크기",
        hint: "타일 대비 너비.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout.allyWidthInTile,
        set: (value) => {
          spriteLayout.allyWidthInTile = value;
        },
      }),
    ];
  }
  if (item.group === "obstacle") {
    const widthField =
      item.obstacleKind === "rock"
        ? "rockWidthInTile"
        : item.variant === 0
          ? "treeWidthInTile"
          : "bushWidthInTile";
    return [
      knob({
        id: "obstacleFoot",
        source: "obstacleFootInTile",
        label: "바닥",
        hint: "모든 지형 공통. 클수록 위로.",
        axis: "y",
        screenSign: 1,
        get: () => spriteLayout.obstacleFootInTile,
        set: (value) => {
          spriteLayout.obstacleFootInTile = value;
        },
      }),
      knob({
        id: "obstacleWidth",
        source: widthField,
        label: "크기",
        hint: item.obstacleKind === "rock" ? "바위 공통." : item.variant === 0 ? "나무." : "덤불 공통.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout[widthField],
        set: (value) => {
          spriteLayout[widthField] = value;
        },
      }),
    ];
  }
  if (item.group === "projectile") {
    const field =
      item.projectile === "arrow"
        ? "arrowLengthInTile"
        : item.projectile === "cannon"
          ? "cannonProjSizeInTile"
          : "mageProjSizeInTile";
    return [
      knob({
        id: "projSize",
        source: field,
        label: "크기",
        hint: "타일 대비 크기.",
        axis: "x",
        screenSign: 1,
        get: () => spriteLayout[field],
        set: (value) => {
          spriteLayout[field] = value;
        },
      }),
    ];
  }
  return [];
}

function towerItems(): GalleryItem[] {
  return TOWER_TYPE_IDS.flatMap((typeId) =>
    Array.from({ length: TOWER_MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      return {
        id: `${typeId}-lv${level}`,
        group: "tower" as const,
        label: `${TOWER_DEFS[typeId].name} Lv${level}`,
        typeId,
        level,
        hasOccupant: typeId !== "wall",
      };
    }),
  );
}

function obstacleItems(): GalleryItem[] {
  const rocks: GalleryItem[] = Array.from({ length: ROCK_VARIANT_COUNT }, (_, variant) => ({
    id: `rock-${variant + 1}`,
    group: "obstacle" as const,
    label: `바위 ${variant + 1}`,
    obstacleKind: "rock" as const,
    variant,
  }));
  const trees: GalleryItem[] = Array.from({ length: TREE_VARIANT_COUNT }, (_, variant) => ({
    id: variant === 0 ? "tree-1" : `bush-${variant}`,
    group: "obstacle" as const,
    label: variant === 0 ? "나무" : `덤불 ${variant}`,
    obstacleKind: "tree" as const,
    variant,
  }));
  return [...rocks, ...trees];
}

function projectileItems(): GalleryItem[] {
  const arrows: GalleryItem = {
    id: "arrow",
    group: "projectile",
    label: "화살",
    projectile: "arrow",
    variant: 0,
  };
  const cannon: GalleryItem[] = Array.from(
    { length: PROJECTILE_VARIANT_COUNT },
    (_, variant) => ({
      id: `cannon-proj-${variant + 1}`,
      group: "projectile" as const,
      label: `대포탄 ${variant + 1}`,
      projectile: "cannon" as const,
      variant,
    }),
  );
  const mage: GalleryItem[] = Array.from(
    { length: PROJECTILE_VARIANT_COUNT },
    (_, variant) => ({
      id: `mage-proj-${variant + 1}`,
      group: "projectile" as const,
      label: `마법탄 ${variant + 1}`,
      projectile: "mage" as const,
      variant,
    }),
  );
  return [arrows, ...cannon, ...mage];
}

export const GALLERY_ITEMS: readonly GalleryItem[] = [
  ...towerItems(),
  ...ENEMY_TYPE_IDS.map((enemyType) => ({
    id: `enemy-${enemyType}`,
    group: "enemy" as const,
    label: ENEMY_LABELS[enemyType],
    enemyType,
  })),
  { id: "ally", group: "ally", label: "아군" },
  ...obstacleItems(),
  ...projectileItems(),
  { id: "start", group: "marker", label: "Start", marker: "start" },
  { id: "base", group: "marker", label: "Base", marker: "base" },
];

export function galleryItemsFor(
  group: GalleryGroup | "all",
): readonly GalleryItem[] {
  if (group === "all") {
    return GALLERY_ITEMS;
  }
  return GALLERY_ITEMS.filter((item) => item.group === group);
}
