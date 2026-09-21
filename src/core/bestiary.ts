/** Enemy bestiary entries. Unlock ids live on campaign progress. */

import type { CampaignProgress } from "./campaign";
import {
  ENEMY_BEHAVIOR_LABELS,
  getEnemyCatalog,
  tryGetEnemy,
  type EnemyBehaviorId,
  type EnemyTypeId,
} from "./enemies";

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
  readonly isNew: boolean;
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
    roster.push({
      id: enemy.id,
      name: enemy.name,
      sprite: enemy.sprite,
      hue: enemy.hue,
      isNew: !known.has(enemy.id),
    });
  }
  return roster;
}
