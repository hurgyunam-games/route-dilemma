import { describe, expect, it } from "vitest";
import { createGrid, hasTower, toggleTower } from "./grid";
import { findPath } from "./path";
import {
  createSim,
  simToggleTower,
  tick,
  unitTile,
  WANDER_RADIUS,
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

  it("waits or wanders at the entrance when the path is fully blocked", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    expect(findPath(sim.grid)).toBeNull();

    for (let i = 0; i < 50; i += 1) {
      sim = tick(sim, 0.2);
      const unit = sim.units[0]!;
      const tile = unitTile(unit);
      expect(tile).not.toEqual(sim.grid.base);
      const dist =
        Math.abs(tile.x - sim.grid.start.x) + Math.abs(tile.y - sim.grid.start.y);
      expect(dist).toBeLessThanOrEqual(WANDER_RADIUS);
    }
  });

  it("does not let a mid-path unit reach Base after a full wall", () => {
    let sim = tick(createSim(createGrid(12, 8)), 2);
    expect(sim.units[0]!.x).toBeGreaterThan(4);
    const id = sim.units[0]!.id;
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    expect(findPath(sim.grid)).toBeNull();

    for (let i = 0; i < 40; i += 1) {
      sim = tick(sim, 0.2);
      expect(sim.units[0]!.id).toBe(id);
      expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    }
  });

  it("resumes along the path after the wall is opened", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    sim = tick(sim, 1.5);
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
