import { describe, expect, it } from "vitest";
import { createGrid, getTower, hasTower, toggleTower, TOWER_MAX_HP } from "./grid";
import { findPath } from "./path";
import {
  ALLY_GOLD_REWARD,
  BASE_MAX_HP,
  createSim,
  ENEMY_BASE_DAMAGE,
  hudSnapshot,
  PHASE_DURATION_SEC,
  SPAWN_INTERVAL_SEC,
  setTimeScale,
  simToggleTower,
  tick,
  TOWER_ATTACK_DPS,
  TOWER_RANGE_TILES,
  UNIT_ATTACK_DPS,
  UNIT_MAX_HP,
  UNIT_SPEED_TILES_PER_SEC,
  unitTile,
  WAVE_SIZE,
} from "./sim";

function wallColumn(grid: ReturnType<typeof createGrid>, x: number) {
  let next = grid;
  for (let y = 0; y < grid.rows; y += 1) {
    next = toggleTower(next, x, y);
  }
  return next;
}

describe("createSim", () => {
  it("spawns a unit on Start", () => {
    const sim = createSim();
    expect(sim.units).toHaveLength(1);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
    expect(sim.gold).toBe(0);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
    expect(sim.units[0]!.hp).toBe(UNIT_MAX_HP);
    expect(sim.towerShots).toEqual([]);
  });
});

describe("tick unit movement", () => {
  it("walks from Start along the shared path toward Base", () => {
    const sim = tick(createSim(createGrid(12, 8)), 1.2);
    const unit = sim.units[0]!;
    const path = findPath(sim.grid)!;
    const tile = unitTile(unit);
    expect(unit.x).toBeGreaterThan(sim.grid.start.x + 2);
    expect(Math.abs(unit.y - sim.grid.start.y)).toBeLessThan(0.15);
    expect(unit.attackTile).toBeNull();
    expect(path.some((step) => step.x === tile.x && step.y === tile.y)).toBe(true);
    expect(tile).not.toEqual(sim.grid.base);
  });

  it("does not walk into a tower when the path is rerouted", () => {
    let sim = tick(createSim(createGrid(12, 8)), 1.4);
    const ahead = { x: Math.round(sim.units[0]!.x) + 1, y: sim.grid.start.y };
    sim = simToggleTower(sim, ahead.x, ahead.y);
    expect(hasTower(sim.grid, ahead.x, ahead.y)).toBe(true);

    let wentAround = false;
    for (let i = 0; i < 40; i += 1) {
      sim = tick(sim, 0.1);
      const unit = sim.units[0]!;
      const tile = unitTile(unit);
      expect(hasTower(sim.grid, tile.x, tile.y)).toBe(false);
      if (Math.abs(unit.y - sim.grid.start.y) > 0.4 || unit.x > ahead.x + 0.4) {
        wentAround = true;
      }
    }

    expect(wentAround).toBe(true);
    expect(findPath(sim.grid)).not.toBeNull();
  });

  it("does not reach Base while a wall still blocks the way", () => {
    let sim = tick(createSim(createGrid(12, 8)), 1);
    const id = sim.units[0]!.id;
    sim = { ...sim, grid: wallColumn(sim.grid, 8) };
    expect(findPath(sim.grid)).toBeNull();

    for (let i = 0; i < 8; i += 1) {
      sim = tick(sim, 0.2);
      expect(sim.units[0]!.id).toBe(id);
      expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    }
  });

  it("resumes along the path after the wall is opened", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    sim = tick(sim, 0.4);
    expect(findPath(sim.grid)).toBeNull();

    sim = simToggleTower(sim, 1, sim.grid.start.y);
    expect(findPath(sim.grid)).not.toBeNull();

    const blockedX = sim.units[0]!.x;
    sim = tick(sim, 1.5);
    expect(sim.units[0]!.x).toBeGreaterThan(blockedX + 0.8);
    expect(hasTower(sim.grid, unitTile(sim.units[0]!).x, unitTile(sim.units[0]!).y)).toBe(
      false,
    );
  });
});

describe("blocked path tower breaking", () => {
  it("attacks the chokepoint tower and lowers its HP", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const target = { x: 1, y: sim.grid.start.y };
    expect(getTower(sim.grid, target.x, target.y)?.hp).toBe(TOWER_MAX_HP);

    sim = tick(sim, 0.5);
    const hp = getTower(sim.grid, target.x, target.y)?.hp;
    expect(hp).toBeDefined();
    expect(hp!).toBeLessThan(TOWER_MAX_HP);
    expect(hp!).toBeCloseTo(TOWER_MAX_HP - UNIT_ATTACK_DPS * 0.5, 5);
    expect(sim.units[0]!.attackTile).toEqual(target);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
  });

  it("walks up to a distant wall before attacking", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 4) };
    const target = { x: 4, y: sim.grid.start.y };
    expect(findPath(sim.grid)).toBeNull();

    sim = tick(sim, 1.3);
    const tile = unitTile(sim.units[0]!);
    expect(tile.x).toBeGreaterThanOrEqual(3);
    expect(tile).not.toEqual(sim.grid.base);

    const hp = getTower(sim.grid, target.x, target.y)?.hp;
    expect(hp).toBeDefined();
    expect(hp!).toBeLessThan(TOWER_MAX_HP);
  });

  it("removes the tower at 0 HP and redraws the path", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const target = { x: 1, y: sim.grid.start.y };
    expect(findPath(sim.grid)).toBeNull();

    sim = tick(sim, TOWER_MAX_HP / UNIT_ATTACK_DPS + 0.05);
    expect(hasTower(sim.grid, target.x, target.y)).toBe(false);
    expect(findPath(sim.grid)).not.toBeNull();
  });

  it("walks toward Base after the broken wall opens a path", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    sim = tick(sim, TOWER_MAX_HP / UNIT_ATTACK_DPS + 0.05);
    expect(findPath(sim.grid)).not.toBeNull();

    const openedX = sim.units[0]!.x;
    sim = tick(sim, 1.5);
    expect(sim.units[0]!.x).toBeGreaterThan(openedX + 0.8);
    expect(hasTower(sim.grid, unitTile(sim.units[0]!).x, unitTile(sim.units[0]!).y)).toBe(
      false,
    );
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.start);
  });
});

function advance(sim: ReturnType<typeof createSim>, seconds: number) {
  let next = sim;
  let left = seconds;
  while (left > 1e-9) {
    const step = Math.min(4, left);
    next = tick(next, step);
    left -= step;
  }
  return next;
}

describe("phase clock", () => {
  it("starts on Enemy Phase with a full timer", () => {
    const sim = createSim();
    const hud = hudSnapshot(sim);
    expect(hud.phase).toBe("enemy");
    expect(hud.phaseTimeLeft).toBe(PHASE_DURATION_SEC);
  });

  it("counts remaining phase time down", () => {
    const sim = tick(createSim(), 1.25);
    expect(sim.phase).toBe("enemy");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_DURATION_SEC - 1.25, 5);
    expect(hudSnapshot(sim).phaseTimeLeft).toBe(sim.phaseTimeLeft);
  });

  it("flips to Ally Phase and restarts the timer at 0", () => {
    const sim = advance(createSim(), PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_DURATION_SEC, 5);
  });

  it("flips back to Enemy Phase on the next timeout", () => {
    const sim = advance(createSim(), PHASE_DURATION_SEC * 2 + 0.4);
    expect(sim.phase).toBe("enemy");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_DURATION_SEC - 0.4, 5);
  });

  it("keeps the map and towers when the phase changes", () => {
    let sim = createSim();
    sim = simToggleTower(sim, 3, 2);
    sim = simToggleTower(sim, 5, 6);
    const placed = sim.grid.towers;
    const start = sim.grid.start;
    const base = sim.grid.base;
    expect(placed).toHaveLength(2);

    sim = advance(sim, PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");
    expect(sim.grid.start).toEqual(start);
    expect(sim.grid.base).toEqual(base);
    expect(sim.grid.cols).toBe(12);
    expect(sim.grid.rows).toBe(8);
    expect(sim.grid.towers).toEqual(placed);
  });
});

describe("time scale", () => {
  it("starts at 1x", () => {
    expect(createSim().timeScale).toBe(1);
    expect(hudSnapshot(createSim()).timeScale).toBe(1);
  });

  it("does not advance units or the phase timer while paused", () => {
    let sim = tick(createSim(createGrid(12, 8)), 0.6);
    sim = setTimeScale(sim, 0);
    const paused = {
      x: sim.units[0]!.x,
      y: sim.units[0]!.y,
      phase: sim.phase,
      phaseTimeLeft: sim.phaseTimeLeft,
      time: sim.time,
    };

    sim = tick(sim, 1);
    expect(sim.units[0]!.x).toBe(paused.x);
    expect(sim.units[0]!.y).toBe(paused.y);
    expect(sim.phase).toBe(paused.phase);
    expect(sim.phaseTimeLeft).toBe(paused.phaseTimeLeft);
    expect(sim.time).toBe(paused.time);
  });

  it("runs faster at 2x and 3x than at 1x", () => {
    const started = tick(createSim(createGrid(12, 8)), 0.4);
    const one = tick(started, 0.8);
    const two = tick(setTimeScale(started, 2), 0.8);
    const three = tick(setTimeScale(started, 3), 0.8);

    expect(two.units[0]!.x).toBeGreaterThan(one.units[0]!.x);
    expect(three.units[0]!.x).toBeGreaterThan(two.units[0]!.x);
    expect(one.phaseTimeLeft - two.phaseTimeLeft).toBeCloseTo(0.8, 5);
    expect(one.phaseTimeLeft - three.phaseTimeLeft).toBeCloseTo(1.6, 5);
  });

  it("still lets towers be placed and removed while paused", () => {
    let sim = setTimeScale(createSim(), 0);
    sim = simToggleTower(sim, 3, 2);
    expect(hasTower(sim.grid, 3, 2)).toBe(true);
    sim = tick(sim, 1);
    expect(hasTower(sim.grid, 3, 2)).toBe(true);
    expect(sim.phaseTimeLeft).toBe(PHASE_DURATION_SEC);
    sim = simToggleTower(sim, 3, 2);
    expect(hasTower(sim.grid, 3, 2)).toBe(false);
  });
});

describe("ally phase gold", () => {
  it("spawns an ally at Start when Ally Phase begins", () => {
    const sim = advance(createSim(), PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");
    expect(sim.units).toHaveLength(1);
    expect(sim.units[0]!.kind).toBe("ally");
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
    expect(sim.gold).toBe(0);
    expect(hudSnapshot(sim).gold).toBe(0);
  });

  it("does not increase gold while the ally is still walking", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = tick(sim, 1.2);
    expect(sim.units[0]!.kind).toBe("ally");
    expect(sim.units[0]!.x).toBeGreaterThan(sim.grid.start.x + 2);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    expect(sim.gold).toBe(0);
  });

  it("increases gold only after the ally reaches Base", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = advance(sim, 4.2);
    expect(sim.gold).toBe(ALLY_GOLD_REWARD);
    expect(hudSnapshot(sim).gold).toBe(ALLY_GOLD_REWARD);
    expect(sim.units[0]!.kind).toBe("ally");
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
  });

  it("waits at the entrance without breaking towers when the path is blocked", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const target = { x: 1, y: sim.grid.start.y };
    const hp = getTower(sim.grid, target.x, target.y)!.hp;
    const id = sim.units[0]!.id;

    sim = tick(sim, 2);
    expect(sim.units[0]!.id).toBe(id);
    expect(sim.units[0]!.kind).toBe("ally");
    expect(sim.units[0]!.attackTile).toBeNull();
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
    expect(getTower(sim.grid, target.x, target.y)?.hp).toBe(hp);
    expect(sim.gold).toBe(0);
  });
});

describe("phase overlap leftover allies", () => {
  it("starts Enemy Phase while a leftover ally is still on the map", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    const ally = sim.units[0]!;
    expect(ally.kind).toBe("ally");
    sim = {
      ...sim,
      units: [{ ...ally, x: 5, y: sim.grid.start.y }],
      phaseTimeLeft: 0.05,
    };

    sim = tick(sim, 0.08);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.id === ally.id && unit.kind === "ally")).toBe(
      true,
    );
    expect(sim.units.some((unit) => unit.kind === "enemy")).toBe(true);
    expect(sim.gold).toBe(0);
    expect(hudSnapshot(sim).leftoverAllies).toBe(1);
  });

  it("pays gold when a leftover ally reaches Base during Enemy Phase", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    const ally = sim.units[0]!;
    sim = {
      ...sim,
      units: [{ ...ally, x: sim.grid.base.x - 0.4, y: sim.grid.base.y }],
      phaseTimeLeft: 0.05,
    };

    sim = tick(sim, 0.3);
    expect(sim.phase).toBe("enemy");
    expect(sim.gold).toBe(ALLY_GOLD_REWARD);
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(false);
  });

  it("pays no gold when a leftover ally is caught by an enemy", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const allyId = sim.units[0]!.id;
    expect(sim.gold).toBe(0);

    sim = advance(sim, sim.phaseTimeLeft);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.id === allyId)).toBe(false);
    expect(sim.units.some((unit) => unit.kind === "enemy")).toBe(true);
    expect(sim.gold).toBe(0);
  });

  it("pays no gold when a leftover ally times out still on the map", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    const ally = sim.units[0]!;
    sim = simToggleTower(sim, 1, 0);
    sim = simToggleTower(sim, 0, 1);
    sim = {
      ...sim,
      units: [{ ...ally, x: 0, y: 0 }],
      spawnedThisWave: WAVE_SIZE,
    };

    sim = advance(sim, sim.phaseTimeLeft);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(true);
    expect(sim.gold).toBe(0);

    sim = advance(sim, sim.phaseTimeLeft);
    expect(sim.phase).toBe("ally");
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(false);
    expect(sim.gold).toBe(0);
  });

  it("still has the ally on the map after Ally Phase when the maze is long", () => {
    const simGrid = createGrid(50, 8);
    const path = findPath(simGrid)!;
    expect(path.length - 1).toBeGreaterThan(UNIT_SPEED_TILES_PER_SEC * PHASE_DURATION_SEC);

    let sim = createSim(simGrid);
    sim = advance(sim, PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");
    sim = advance(sim, PHASE_DURATION_SEC);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.kind === "ally")).toBe(true);
    expect(sim.gold).toBe(0);
    expect(hudSnapshot(sim).leftoverAllies).toBeGreaterThan(0);
  });
});

describe("enemy phase base damage", () => {
  it("spawns an enemy at Start during Enemy Phase", () => {
    const sim = createSim();
    expect(sim.phase).toBe("enemy");
    expect(sim.units).toHaveLength(1);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
    expect(hudSnapshot(sim).baseHp).toBe(BASE_MAX_HP);
  });

  it("does not decrease base HP while the enemy is still walking", () => {
    const sim = tick(createSim(createGrid(12, 8)), 1.2);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(sim.units[0]!.x).toBeGreaterThan(sim.grid.start.x + 2);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
  });

  it("decreases base HP only after the enemy reaches Base", () => {
    const sim = advance(createSim(createGrid(12, 8)), 4.2);
    expect(sim.baseHp).toBe(BASE_MAX_HP - ENEMY_BASE_DAMAGE);
    expect(hudSnapshot(sim).baseHp).toBe(BASE_MAX_HP - ENEMY_BASE_DAMAGE);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
  });

  it("does not damage the base while enemies are breaking a blocked wall", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const target = { x: 1, y: sim.grid.start.y };
    const id = sim.units[0]!.id;

    sim = tick(sim, 0.5);
    expect(sim.units[0]!.id).toBe(id);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(sim.units[0]!.attackTile).toEqual(target);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    expect(getTower(sim.grid, target.x, target.y)?.hp).toBeLessThan(TOWER_MAX_HP);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
  });

  it("damages the base after the broken wall opens and the enemy reaches Base", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    sim = tick(sim, TOWER_MAX_HP / UNIT_ATTACK_DPS + 0.05);
    expect(findPath(sim.grid)).not.toBeNull();
    expect(sim.baseHp).toBe(BASE_MAX_HP);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);

    sim = advance(sim, 4.5);
    expect(sim.baseHp).toBeLessThan(BASE_MAX_HP);
    expect(hudSnapshot(sim).baseHp).toBe(sim.baseHp);
  });
});

describe("tower attacks", () => {
  it("damages an in-range enemy and records a shot", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, sim.grid.start.x, sim.grid.start.y + 1);
    sim = tick(sim, 0.25);
    const enemy = sim.units[0]!;
    expect(enemy.kind).toBe("enemy");
    expect(enemy.hp).toBeCloseTo(UNIT_MAX_HP - TOWER_ATTACK_DPS * 0.25, 5);
    expect(sim.towerShots).toHaveLength(1);
    expect(sim.towerShots[0]).toMatchObject({
      fromX: sim.grid.start.x,
      fromY: sim.grid.start.y + 1,
    });
    expect(sim.towerShots[0]!.toX).toBeCloseTo(enemy.x, 5);
    expect(sim.towerShots[0]!.toY).toBeCloseTo(enemy.y, 5);
  });

  it("removes an enemy when HP reaches 0", () => {
    let sim = createSim(createGrid(12, 8));
    const id = sim.units[0]!.id;
    const lane = sim.grid.start.y + 1;
    for (let x = 1; x <= 9; x += 1) {
      sim = simToggleTower(sim, x, lane);
    }
    sim = { ...sim, spawnedThisWave: WAVE_SIZE };

    sim = advance(sim, UNIT_MAX_HP / TOWER_ATTACK_DPS + 0.5);
    expect(sim.units.some((unit) => unit.id === id)).toBe(false);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
  });

  it("does not hit an enemy outside tower range", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, sim.grid.base.x, 0);
    sim = tick(sim, 2);
    const enemy = sim.units[0]!;
    expect(enemy.kind).toBe("enemy");
    expect(Math.hypot(enemy.x - sim.grid.base.x, enemy.y - 0)).toBeGreaterThan(
      TOWER_RANGE_TILES,
    );
    expect(enemy.hp).toBe(UNIT_MAX_HP);
    expect(sim.towerShots).toHaveLength(0);
  });

  it("does not attack allies", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = simToggleTower(sim, sim.grid.start.x, sim.grid.start.y + 1);
    sim = tick(sim, 0.25);
    const ally = sim.units[0]!;
    expect(ally.kind).toBe("ally");
    expect(ally.hp).toBe(UNIT_MAX_HP);
    expect(sim.towerShots).toHaveLength(0);
  });
});

describe("wave spawn", () => {
  it("spawns several enemies during Enemy Phase, not just one", () => {
    const sim = tick(
      createSim(createGrid(12, 8)),
      SPAWN_INTERVAL_SEC * (WAVE_SIZE - 1) + 0.05,
    );
    expect(sim.phase).toBe("enemy");
    expect(sim.units.filter((unit) => unit.kind === "enemy")).toHaveLength(WAVE_SIZE);
  });

  it("spawns enemies spaced apart instead of stacked on Start", () => {
    const sim = tick(
      createSim(createGrid(12, 8)),
      SPAWN_INTERVAL_SEC * 3 + 0.1,
    );
    const enemies = sim.units.filter((unit) => unit.kind === "enemy");
    expect(enemies.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < enemies.length; i += 1) {
      for (let j = i + 1; j < enemies.length; j += 1) {
        const dist = Math.hypot(
          enemies[i]!.x - enemies[j]!.x,
          enemies[i]!.y - enemies[j]!.y,
        );
        expect(dist).toBeGreaterThan(0.8);
      }
    }
  });

  it("keeps more than one enemy on the map at once", () => {
    const sim = tick(createSim(createGrid(12, 8)), SPAWN_INTERVAL_SEC * 2 + 0.2);
    expect(sim.units.filter((unit) => unit.kind === "enemy").length).toBeGreaterThan(1);
    expect(
      sim.units.every((unit) => unitTile(unit).x !== sim.grid.base.x),
    ).toBe(true);
  });

  it("damages the base once per enemy that arrives", () => {
    const sim = advance(
      createSim(createGrid(12, 8)),
      11 / UNIT_SPEED_TILES_PER_SEC + SPAWN_INTERVAL_SEC + 0.3,
    );
    expect(sim.baseHp).toBe(BASE_MAX_HP - ENEMY_BASE_DAMAGE * 2);
  });

  it("spawns several allies in Ally Phase and pays gold per arrival", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");

    sim = tick(sim, SPAWN_INTERVAL_SEC * 2 + 0.2);
    expect(sim.units.filter((unit) => unit.kind === "ally").length).toBeGreaterThan(1);
    expect(sim.gold).toBe(0);

    sim = advance(
      createSim(createGrid(12, 8)),
      PHASE_DURATION_SEC + 11 / UNIT_SPEED_TILES_PER_SEC + SPAWN_INTERVAL_SEC + 0.3,
    );
    expect(sim.phase).toBe("ally");
    expect(sim.gold).toBe(ALLY_GOLD_REWARD * 2);
  });

  it("does not stack a new spawn on a unit still at Start", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    sim = tick(sim, SPAWN_INTERVAL_SEC + 0.05);
    const enemies = sim.units.filter((unit) => unit.kind === "enemy");
    expect(enemies).toHaveLength(1);
    expect(unitTile(enemies[0]!)).toEqual(sim.grid.start);
  });
});
