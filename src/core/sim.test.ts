import { describe, expect, it } from "vitest";
import { createGrid, getTower, hasTower, toggleTower, TOWER_MAX_HP } from "./grid";
import { findPath } from "./path";
import {
  createSim,
  hudSnapshot,
  PHASE_DURATION_SEC,
  setTimeScale,
  simToggleTower,
  tick,
  UNIT_ATTACK_DPS,
  unitTile,
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
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
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
