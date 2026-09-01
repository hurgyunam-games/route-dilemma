import { describe, expect, it } from "vitest";
import {
  createGrid,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  fitGridToViewport,
  forEachTile,
  tileKind,
} from "./grid";

describe("createGrid", () => {
  it("uses 12×8 by default", () => {
    const grid = createGrid();
    expect(grid.cols).toBe(DEFAULT_GRID_COLS);
    expect(grid.rows).toBe(DEFAULT_GRID_ROWS);
    expect(grid.cols).toBe(12);
    expect(grid.rows).toBe(8);
  });

  it("accepts a custom size", () => {
    const grid = createGrid(10, 6);
    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(6);
  });

  it("puts Start on the left edge and Base on the right edge", () => {
    const grid = createGrid(12, 8);
    expect(grid.start).toEqual({ x: 0, y: 3 });
    expect(grid.base).toEqual({ x: 11, y: 3 });
  });

  it("keeps Start and Base on the same cells every time", () => {
    expect(createGrid().start).toEqual(createGrid().start);
    expect(createGrid().base).toEqual(createGrid().base);
  });

  it("rejects non-positive sizes", () => {
    expect(() => createGrid(0, 8)).toThrow();
    expect(() => createGrid(12, -1)).toThrow();
  });
});

describe("tileKind", () => {
  it("distinguishes Start, Base, and empty tiles", () => {
    const grid = createGrid(12, 8);
    expect(tileKind(grid, 0, 3)).toBe("start");
    expect(tileKind(grid, 11, 3)).toBe("base");
    expect(tileKind(grid, 1, 3)).toBe("empty");
    expect(tileKind(grid, 0, 0)).toBe("empty");
  });
});

describe("forEachTile", () => {
  it("visits every cell once, left-to-right then top-to-bottom", () => {
    const seen: string[] = [];
    forEachTile(createGrid(2, 3), (x, y) => {
      seen.push(`${x},${y}`);
    });
    expect(seen).toEqual(["0,0", "1,0", "0,1", "1,1", "0,2", "1,2"]);
  });
});

describe("fitGridToViewport", () => {
  it("keeps the map inside the viewport", () => {
    const layout = fitGridToViewport(createGrid(12, 8), 800, 600);
    expect(layout.originX).toBeGreaterThanOrEqual(0);
    expect(layout.originY).toBeGreaterThanOrEqual(0);
    expect(layout.originX + layout.width).toBeLessThanOrEqual(800);
    expect(layout.originY + layout.height).toBeLessThanOrEqual(600);
  });

  it("uses square tiles sized by the tighter axis", () => {
    const layout = fitGridToViewport(createGrid(10, 5), 1000, 400, 0);
    expect(layout.tileSize).toBe(80);
    expect(layout.width).toBe(800);
    expect(layout.height).toBe(400);
  });

  it("centers the grid in leftover space", () => {
    const layout = fitGridToViewport(createGrid(10, 5), 1000, 400, 0);
    expect(layout.originX).toBe(100);
    expect(layout.originY).toBe(0);
  });

  it("shrinks tiles so padding keeps the map off the viewport edge", () => {
    const padding = 32;
    const vw = 640;
    const vh = 360;
    const layout = fitGridToViewport(createGrid(12, 8), vw, vh, padding);
    expect(layout.width).toBeLessThanOrEqual(vw - padding * 2);
    expect(layout.height).toBeLessThanOrEqual(vh - padding * 2);
    expect(layout.originX).toBeGreaterThanOrEqual(0);
    expect(layout.originY).toBeGreaterThanOrEqual(0);
    expect(layout.originX + layout.width).toBeLessThanOrEqual(vw);
    expect(layout.originY + layout.height).toBeLessThanOrEqual(vh);
  });
});
