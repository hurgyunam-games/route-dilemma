import { describe, expect, it } from "vitest";
import {
  BESTIARY_LOCKED_NAME,
  ENEMY_ROLE_LABELS,
  bestiaryEntries,
  isBestiaryEnemyUnlocked,
  unlockBestiaryEnemies,
  wavePreviewRoster,
} from "./bestiary";
import { createCampaign } from "./campaign";
import { ENEMY_BEHAVIOR_LABELS, getEnemyCatalog } from "./enemies";

describe("bestiary", () => {
  it("starts with every catalog enemy locked as a silhouette", () => {
    const catalog = getEnemyCatalog();
    const entries = bestiaryEntries(createCampaign().bestiaryUnlocked);
    expect(entries).toHaveLength(catalog.length);
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.every((entry) => !entry.unlocked && !entry.isNew)).toBe(true);
    expect(entries.every((entry) => entry.name === BESTIARY_LOCKED_NAME)).toBe(true);
    expect(entries.every((entry) => entry.behaviorLabel === null && entry.role === null)).toBe(
      true,
    );
    expect(new Set(entries.map((entry) => entry.sprite)).size).toBeGreaterThan(1);
  });

  it("hides features for locked enemies and shows them after unlock", () => {
    const catalog = getEnemyCatalog();
    const lockedId = catalog[0]!.id;
    const open = catalog.find((enemy) => enemy.id !== lockedId && enemy.behavior !== "normal")
      ?? catalog[1]!;
    const entries = bestiaryEntries([open.id]);
    const locked = entries.find((entry) => entry.id === lockedId)!;
    const unlocked = entries.find((entry) => entry.id === open.id)!;

    expect(isBestiaryEnemyUnlocked([open.id], open.id)).toBe(true);
    expect(isBestiaryEnemyUnlocked([open.id], lockedId)).toBe(false);
    expect(locked.unlocked).toBe(false);
    expect(locked.isNew).toBe(false);
    expect(locked.name).toBe(BESTIARY_LOCKED_NAME);
    expect(locked.behaviorLabel).toBeNull();
    expect(locked.role).toBeNull();
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.isNew).toBe(false);
    expect(unlocked.name).toBe(open.name);
    expect(unlocked.behaviorLabel).toBe(ENEMY_BEHAVIOR_LABELS[open.behavior]);
    expect(unlocked.role).toBe(ENEMY_ROLE_LABELS[open.behavior]);
    expect(unlocked.hue).toBe(open.hue);
  });

  it("unlocks previewed catalog enemies and leaves the rest locked", () => {
    const catalog = getEnemyCatalog();
    const first = catalog[0]!;
    const second = catalog[1]!;
    const opened = unlockBestiaryEnemies(createCampaign(), [first.id, "missing-enemy"]);
    expect(opened.bestiaryUnlocked).toEqual([first.id]);
    expect(unlockBestiaryEnemies(opened, [first.id])).toBe(opened);

    const roster = wavePreviewRoster([first.id, first.id, second.id], opened.bestiaryUnlocked);
    expect(roster.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(roster[0]?.isNew).toBe(false);
    expect(roster[1]?.isNew).toBe(true);
    expect(roster[1]?.name).toBe(second.name);

    const entries = bestiaryEntries(opened.bestiaryUnlocked, [second.id, first.id]);
    expect(entries.find((entry) => entry.id === first.id)?.unlocked).toBe(true);
    expect(entries.find((entry) => entry.id === first.id)?.isNew).toBe(true);
    expect(entries.find((entry) => entry.id === second.id)?.unlocked).toBe(false);
    expect(entries.find((entry) => entry.id === second.id)?.isNew).toBe(false);
  });
});
