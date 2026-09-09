import { describe, expect, it } from "vitest";
import { createGrid, hasObstacle, hasTower, sameTile, toggleTower } from "./grid";
import { findPath } from "./path";

function isOrthogonalStep(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

describe("findPath", () => {
  it("starts at Start and ends at Base", () => {
    const grid = createGrid();
    const path = findPath(grid);
    expect(path).not.toBeNull();
    expect(sameTile(path![0], grid.start)).toBe(true);
    expect(sameTile(path![path!.length - 1], grid.base)).toBe(true);
  });

  it("returns a connected orthogonal path", () => {
    const grid = createGrid();
    const path = findPath(grid)!;
    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i += 1) {
      expect(isOrthogonalStep(path[i - 1]!, path[i]!)).toBe(true);
    }
  });

  it("takes the short left-to-right line on an empty map", () => {
    const grid = createGrid(12, 8);
    const path = findPath(grid)!;
    const manhattan = Math.abs(grid.base.x - grid.start.x) + Math.abs(grid.base.y - grid.start.y);
    expect(path).toHaveLength(manhattan + 1);
    expect(path.every((tile) => tile.y === grid.start.y)).toBe(true);
    expect(path.map((tile) => tile.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("reroutes around a tower that sat on the previous path", () => {
    const empty = createGrid(12, 8);
    const original = findPath(empty)!;
    const blocked = original[5]!;
    const withTower = toggleTower(empty, blocked.x, blocked.y);
    const rerouted = findPath(withTower)!;
    expect(rerouted.some((tile) => sameTile(tile, blocked))).toBe(false);
    expect(sameTile(rerouted[0]!, empty.start)).toBe(true);
    expect(sameTile(rerouted[rerouted.length - 1]!, empty.base)).toBe(true);
    expect(rerouted.length).toBeGreaterThan(original.length);
  });

  it("returns to the short path when that tower is removed", () => {
    const empty = createGrid(12, 8);
    const original = findPath(empty)!;
    const blocked = original[5]!;
    const withTower = toggleTower(empty, blocked.x, blocked.y);
    const restored = toggleTower(withTower, blocked.x, blocked.y);
    expect(findPath(restored)).toEqual(original);
  });

  it("still places a blocking wall and then reports no path", () => {
    const grid = createGrid(12, 8);
    let next = grid;
    for (let y = 0; y < grid.rows; y += 1) {
      next = toggleTower(next, 1, y);
      expect(hasTower(next, 1, y)).toBe(true);
    }
    expect(next.towers).toHaveLength(grid.rows);
    expect(findPath(next)).toBeNull();
  });

  it("finds a path from a mid-map tile to Base", () => {
    const grid = createGrid(12, 8);
    const from = { x: 4, y: 3 };
    const path = findPath(grid, from, grid.base)!;
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(grid.base);
  });

  it("reroutes around a natural obstacle", () => {
    const empty = createGrid(12, 8);
    const original = findPath(empty)!;
    const blocked = original[5]!;
    const withRock = createGrid(12, 8, empty.start, empty.base, [
      { kind: "rock", x: blocked.x, y: blocked.y },
    ]);
    const rerouted = findPath(withRock)!;
    expect(hasObstacle(withRock, blocked.x, blocked.y)).toBe(true);
    expect(rerouted.some((tile) => sameTile(tile, blocked))).toBe(false);
    expect(sameTile(rerouted[0]!, empty.start)).toBe(true);
    expect(sameTile(rerouted[rerouted.length - 1]!, empty.base)).toBe(true);
    expect(rerouted.length).toBeGreaterThan(original.length);
  });

  it("punches through towers when throughTowers is set", () => {
    const empty = createGrid(12, 8);
    let walled = empty;
    for (let y = 0; y < empty.rows; y += 1) {
      walled = toggleTower(walled, 1, y);
    }
    expect(findPath(walled)).toBeNull();
    const punch = findPath(walled, walled.start, walled.base, { throughTowers: true });
    expect(punch).not.toBeNull();
    expect(sameTile(punch![0]!, empty.start)).toBe(true);
    expect(sameTile(punch![punch!.length - 1]!, empty.base)).toBe(true);
    expect(punch!.some((tile) => tile.x === 1 && hasTower(walled, tile.x, tile.y))).toBe(true);
  });
});
