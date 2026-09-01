import { describe, expect, it } from "vitest";
import { createGrid, getTower, hasTower, toggleTower, TOWER_MAX_HP } from "./grid";
import { findPath } from "./path";
import {
  createSim,
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
