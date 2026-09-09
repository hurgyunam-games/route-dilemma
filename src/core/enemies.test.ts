import { afterEach, describe, expect, it } from "vitest";
import {
  bundledEnemyTable,
  cloneEnemyTable,
  getEnemy,
  getEnemyCatalog,
  nextEnemyId,
  parseEnemyTableJson,
  resetEnemyTable,
  serializeEnemyTable,
  setEnemyTable,
} from "./enemies";

describe("enemy catalog", () => {
  afterEach(() => {
    resetEnemyTable();
  });

  it("loads unique enemies with known sprites", () => {
    const catalog = getEnemyCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(getEnemy("slime-10")).toMatchObject({ sprite: "slime", hp: 10 });
    expect(new Set(catalog.map((enemy) => enemy.id)).size).toBe(catalog.length);
  });

  it("round-trips through serialize and parse", () => {
    const parsed = parseEnemyTableJson(serializeEnemyTable(bundledEnemyTable()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.table.enemies).toEqual(bundledEnemyTable().enemies);
  });

  it("rejects an empty catalog and duplicate ids", () => {
    expect(parseEnemyTableJson('{"enemies":[]}').ok).toBe(false);
    const clone = cloneEnemyTable(bundledEnemyTable());
    const dup = {
      enemies: [clone.enemies[0]!, clone.enemies[0]!],
    };
    expect(parseEnemyTableJson(JSON.stringify(dup)).ok).toBe(false);
  });

  it("applies an override so getEnemy reads the edited hp", () => {
    const next = cloneEnemyTable({ enemies: [...getEnemyCatalog()] });
    const first = next.enemies[0];
    if (!first) {
      throw new Error("missing enemy");
    }
    setEnemyTable({
      enemies: [{ ...first, hp: 77 }, ...next.enemies.slice(1)],
    });
    expect(getEnemy(first.id).hp).toBe(77);
  });

  it("allocates a free id when sprite-hp is taken", () => {
    expect(nextEnemyId("slime", 10, ["slime-10"])).toBe("slime-10-2");
    expect(nextEnemyId("slime", 99, ["slime-10"])).toBe("slime-99");
  });

  it("defaults missing hue to 0 and wraps out-of-range values", () => {
    const parsed = parseEnemyTableJson(
      JSON.stringify({
        enemies: [{ id: "slime-10", name: "슬라임", sprite: "slime", hp: 10 }],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.table.enemies[0]?.hue).toBe(0);

    const wrapped = parseEnemyTableJson(
      JSON.stringify({
        enemies: [{ id: "slime-10", name: "슬라임", sprite: "slime", hp: 10, hue: 400 }],
      }),
    );
    expect(wrapped.ok).toBe(true);
    if (!wrapped.ok) {
      return;
    }
    expect(wrapped.table.enemies[0]?.hue).toBe(40);
  });
});
