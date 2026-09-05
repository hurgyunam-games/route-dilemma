import { describe, expect, it } from "vitest";
import { createGrid } from "./grid";
import { findPath } from "./path";
import {
  createMapGrid,
  getGameMap,
  isMapId,
  WORLD_MAP_COUNT,
  WORLD_MAPS,
} from "./maps";

function layoutKey(map: {
  cols: number;
  rows: number;
  start: { x: number; y: number };
  base: { x: number; y: number };
}): string {
  return `${map.cols}x${map.rows}:${map.start.x},${map.start.y}->${map.base.x},${map.base.y}`;
}

describe("world maps", () => {
  it("lists five distinct battle maps", () => {
    expect(WORLD_MAPS).toHaveLength(WORLD_MAP_COUNT);
    expect(WORLD_MAP_COUNT).toBe(5);
    expect(WORLD_MAPS.map((map) => map.id)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(WORLD_MAPS.map((map) => map.name)).size).toBe(5);
    expect(new Set(WORLD_MAPS.map(layoutKey)).size).toBe(5);
  });

  it("keeps Start and Base on different tiles inside each map", () => {
    for (const map of WORLD_MAPS) {
      expect(map.start).not.toEqual(map.base);
      expect(map.start.x).toBeGreaterThanOrEqual(0);
      expect(map.start.y).toBeGreaterThanOrEqual(0);
      expect(map.start.x).toBeLessThan(map.cols);
      expect(map.start.y).toBeLessThan(map.rows);
      expect(map.base.x).toBeGreaterThanOrEqual(0);
      expect(map.base.y).toBeGreaterThanOrEqual(0);
      expect(map.base.x).toBeLessThan(map.cols);
      expect(map.base.y).toBeLessThan(map.rows);
    }
  });

  it("builds a stable grid for each map, with a Start-to-Base path", () => {
    for (const map of WORLD_MAPS) {
      const grid = createMapGrid(map.id);
      expect(grid.cols).toBe(map.cols);
      expect(grid.rows).toBe(map.rows);
      expect(grid.start).toEqual(map.start);
      expect(grid.base).toEqual(map.base);
      expect(grid.towers).toEqual([]);
      expect(createMapGrid(map.id)).toEqual(grid);
      expect(findPath(grid)?.at(0)).toEqual(map.start);
      expect(findPath(grid)?.at(-1)).toEqual(map.base);
    }
    expect(createMapGrid(1)).toEqual(createGrid());
  });

  it("does not change layouts when the world map is listed again", () => {
    expect(WORLD_MAPS.map(layoutKey)).toEqual(WORLD_MAPS.map(layoutKey));
    expect(getGameMap(3)).toEqual(getGameMap(3));
  });

  it("rejects unknown map ids", () => {
    expect(isMapId(1)).toBe(true);
    expect(isMapId(5)).toBe(true);
    expect(isMapId(0)).toBe(false);
    expect(isMapId(6)).toBe(false);
    expect(() => getGameMap(0)).toThrow();
    expect(() => createMapGrid(99)).toThrow();
  });
});

describe("createGrid custom Start/Base", () => {
  it("uses the given Start and Base tiles", () => {
    const grid = createGrid(8, 12, { x: 3, y: 11 }, { x: 4, y: 0 });
    expect(grid.start).toEqual({ x: 3, y: 11 });
    expect(grid.base).toEqual({ x: 4, y: 0 });
  });

  it("rejects Start or Base outside the grid", () => {
    expect(() => createGrid(4, 4, { x: -1, y: 0 }, { x: 3, y: 3 })).toThrow();
    expect(() => createGrid(4, 4, { x: 0, y: 0 }, { x: 4, y: 0 })).toThrow();
  });
});
