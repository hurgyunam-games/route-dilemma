/** Enemy bestiary entries. Unlock ids live on campaign progress. */

import type { CampaignProgress } from "./campaign";
import {
  ENEMY_BEHAVIOR_LABELS,
  getEnemyCatalog,
  tryGetEnemy,
  type EnemyBehaviorId,
  type EnemyTypeId,
} from "./enemies";

export const SPECIAL_BEHAVIOR_IDS = ["breaker", "ambush"] as const;
export type SpecialBehaviorId = (typeof SPECIAL_BEHAVIOR_IDS)[number];

export type BehaviorWarning = {
  readonly behavior: SpecialBehaviorId;
  readonly title: string;
  readonly message: string;
};

const BEHAVIOR_WARNINGS: Record<SpecialBehaviorId, Omit<BehaviorWarning, "behavior">> = {
  breaker: {
    title: "벽뚫기",
    message: "돌진 적은 길을 따라가지 않고, 앞을 막는 타워를 부수며 직진합니다.",
  },
  ambush: {
    title: "약탈",
    message: "약탈 적은 타워가 닿지 않는 곳에 숨었다가, 아군 수송을 공격합니다.",
  },
};

export function isSpecialBehavior(value: string): value is SpecialBehaviorId {
  return (SPECIAL_BEHAVIOR_IDS as readonly string[]).includes(value);
}

export function behaviorWarning(behavior: string): BehaviorWarning | null {
  if (!isSpecialBehavior(behavior)) {
    return null;
  }
  return { behavior, ...BEHAVIOR_WARNINGS[behavior] };
}

function warningsForBehaviors(
  behaviors: readonly string[],
  warned: readonly string[],
): readonly BehaviorWarning[] {
  const seen = new Set(warned);
  const warnings: BehaviorWarning[] = [];
  for (const behavior of behaviors) {
    const warning = behaviorWarning(behavior);
    if (!warning || seen.has(warning.behavior)) {
      continue;
    }
    seen.add(warning.behavior);
    warnings.push(warning);
  }
  return warnings;
}

/** First-time warnings for special behaviors in this assault, in roster order. */
export function behaviorWarningsForEnemies(
  enemyIds: readonly string[],
  warned: readonly string[] = [],
): readonly BehaviorWarning[] {
  const behaviors: string[] = [];
  for (const id of enemyIds) {
    const enemy = tryGetEnemy(id);
    if (enemy) {
      behaviors.push(enemy.behavior);
    }
  }
  return warningsForBehaviors(behaviors, warned);
}

/** First-time warnings for enemies that just appeared on the map. */
export function behaviorWarningsForUnits(
  units: readonly { readonly kind: string; readonly behavior: string }[],
  warned: readonly string[] = [],
): readonly BehaviorWarning[] {
  return warningsForBehaviors(
    units.filter((unit) => unit.kind === "enemy").map((unit) => unit.behavior),
    warned,
  );
}

export function markBehaviorWarnings(
  progress: CampaignProgress,
  behaviors: readonly string[],
): CampaignProgress {
  const have = new Set(progress.warnedBehaviors);
  const added: SpecialBehaviorId[] = [];
  for (const behavior of behaviors) {
    if (!isSpecialBehavior(behavior) || have.has(behavior)) {
      continue;
    }
    have.add(behavior);
    added.push(behavior);
  }
  if (added.length === 0) {
    return progress;
  }
  return {
    ...progress,
    warnedBehaviors: [...progress.warnedBehaviors, ...added],
  };
}

export const BESTIARY_LOCKED_NAME = "???";

export const ENEMY_ROLE_LABELS: Record<EnemyBehaviorId, string> = {
  normal: "길을 따라 본진으로 향한다",
  breaker: "타워를 부수며 앞으로 돌진한다",
  ambush: "사각에 숨어 아군을 노린다",
};

export type BestiaryEntry = {
  readonly id: string;
  readonly unlocked: boolean;
  readonly isNew: boolean;
  readonly name: string;
  readonly sprite: EnemyTypeId;
  readonly hue: number;
  readonly behaviorLabel: string | null;
  readonly role: string | null;
};

export function isBestiaryEnemyUnlocked(
  unlockedIds: readonly string[],
  enemyId: string,
): boolean {
  return unlockedIds.includes(enemyId);
}

export function bestiaryEntries(
  unlockedIds: readonly string[] = [],
  newIds: readonly string[] = [],
): readonly BestiaryEntry[] {
  const unlocked = new Set(unlockedIds);
  const fresh = new Set(newIds);
  return getEnemyCatalog().map((enemy) => {
    const open = unlocked.has(enemy.id);
    return {
      id: enemy.id,
      unlocked: open,
      isNew: open && fresh.has(enemy.id),
      name: open ? enemy.name : BESTIARY_LOCKED_NAME,
      sprite: enemy.sprite,
      hue: open ? enemy.hue : 0,
      behaviorLabel: open ? ENEMY_BEHAVIOR_LABELS[enemy.behavior] : null,
      role: open ? ENEMY_ROLE_LABELS[enemy.behavior] : null,
    };
  });
}

export function unlockBestiaryEnemies(
  progress: CampaignProgress,
  enemyIds: readonly string[],
): CampaignProgress {
  const have = new Set(progress.bestiaryUnlocked);
  const added: string[] = [];
  for (const id of enemyIds) {
    if (have.has(id) || !tryGetEnemy(id)) {
      continue;
    }
    have.add(id);
    added.push(id);
  }
  if (added.length === 0) {
    return progress;
  }
  return {
    ...progress,
    bestiaryUnlocked: [...progress.bestiaryUnlocked, ...added],
  };
}

export type WavePreviewEntry = {
  readonly id: string;
  readonly name: string;
  readonly sprite: EnemyTypeId;
  readonly hue: number;
  readonly behavior: EnemyBehaviorId;
  readonly isNew: boolean;
  readonly warningTitle: string | null;
  readonly warningMessage: string | null;
};

export function wavePreviewRoster(
  enemyIds: readonly string[],
  unlockedIds: readonly string[] = [],
): readonly WavePreviewEntry[] {
  const known = new Set(unlockedIds);
  const roster: WavePreviewEntry[] = [];
  const seen = new Set<string>();
  for (const id of enemyIds) {
    if (seen.has(id)) {
      continue;
    }
    const enemy = tryGetEnemy(id);
    if (!enemy) {
      continue;
    }
    seen.add(id);
    const warning = behaviorWarning(enemy.behavior);
    roster.push({
      id: enemy.id,
      name: enemy.name,
      sprite: enemy.sprite,
      hue: enemy.hue,
      behavior: enemy.behavior,
      isNew: !known.has(enemy.id),
      warningTitle: warning?.title ?? null,
      warningMessage: warning?.message ?? null,
    });
  }
  return roster;
}
