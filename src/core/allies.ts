export const ALLY_TYPE_IDS = ["porter", "courier", "runner", "merchant"] as const;
export type AllyTypeId = (typeof ALLY_TYPE_IDS)[number];

export const ALLY_SPRITE_LABELS: Record<AllyTypeId, string> = {
  porter: "짐꾼",
  courier: "전령",
  runner: "행상",
  merchant: "상인",
};

export const ALLY_GOLD: Record<AllyTypeId, number> = {
  porter: 10,
  courier: 15,
  runner: 20,
  merchant: 30,
};

export const DEFAULT_ALLY_TYPE: AllyTypeId = "porter";
export const ALLY_GOLD_REWARD = ALLY_GOLD[DEFAULT_ALLY_TYPE];

export function allyTypeAt(index: number): AllyTypeId {
  const count = ALLY_TYPE_IDS.length;
  const n = Number.isFinite(index) ? Math.round(index) : 0;
  return ALLY_TYPE_IDS[((n % count) + count) % count]!;
}

export function allyGoldReward(type: AllyTypeId | null | undefined): number {
  return ALLY_GOLD[type ?? DEFAULT_ALLY_TYPE];
}
