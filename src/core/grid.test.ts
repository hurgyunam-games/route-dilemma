import { describe, expect, it } from "vitest";
import {
  createGrid,
  damageTower,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  fitGridToViewport,
  forEachTile,
  getTower,
  hasTower,
  tileKind,
  toggleTower,
  TOWER_MAX_HP,
  viewportToTile,
  placeTower,
  removeTower,
  advanceTowerBuilds,
  upgradeTower,
} from "./grid";
import { BUILD_DURATION_SEC, UPGRADE_DURATION_SEC } from "./towers";

describe("createGrid", () => {
  it("uses 12×8 by default", () => {
    const grid = createGrid();
    expect(grid.cols).toBe(DEFAULT_GRID_COLS);
    expect(grid.rows).toBe(DEFAULT_GRID_ROWS);
    expect(grid.cols).toBe(12);
    expect(grid.rows).toBe(8);
    expect(grid.towers).toEqual([]);
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
  it("distinguishes Start, Base, empty, and tower tiles", () => {
    const grid = createGrid(12, 8);
    expect(tileKind(grid, 0, 3)).toBe("start");
    expect(tileKind(grid, 11, 3)).toBe("base");
    expect(tileKind(grid, 1, 3)).toBe("empty");
    expect(tileKind(grid, 0, 0)).toBe("empty");
    expect(tileKind(toggleTower(grid, 1, 3), 1, 3)).toBe("tower");
  });
});

describe("toggleTower", () => {
  it("places a tower on an empty tile", () => {
    const next = toggleTower(createGrid(12, 8), 1, 3);
    expect(hasTower(next, 1, 3)).toBe(true);
    expect(tileKind(next, 1, 3)).toBe("tower");
    expect(getTower(next, 1, 3)?.hp).toBe(TOWER_MAX_HP);
    expect(getTower(next, 1, 3)?.typeId).toBe("archer");
    expect(getTower(next, 1, 3)?.level).toBe(1);
    expect(getTower(next, 1, 3)?.buildTimeLeft).toBe(0);
  });

  it("removes a tower when the same tile is toggled again", () => {
    const placed = toggleTower(createGrid(12, 8), 4, 2);
    const cleared = toggleTower(placed, 4, 2);
    expect(hasTower(cleared, 4, 2)).toBe(false);
    expect(tileKind(cleared, 4, 2)).toBe("empty");
    expect(cleared.towers).toEqual([]);
  });

  it("does not place a tower on Start or Base", () => {
    const grid = createGrid(12, 8);
    expect(toggleTower(grid, grid.start.x, grid.start.y)).toBe(grid);
    expect(toggleTower(grid, grid.base.x, grid.base.y)).toBe(grid);
    expect(hasTower(toggleTower(grid, 0, 3), 0, 3)).toBe(false);
    expect(hasTower(toggleTower(grid, 11, 3), 11, 3)).toBe(false);
  });

  it("places towers even when they would block Start to Base", () => {
    const grid = createGrid(12, 8);
    const wallX = 1;
    let next = grid;
    for (let y = 0; y < grid.rows; y += 1) {
      next = toggleTower(next, wallX, y);
      expect(hasTower(next, wallX, y)).toBe(true);
    }
    expect(next.towers).toHaveLength(grid.rows);
  });

  it("ignores out-of-bounds clicks", () => {
    const grid = createGrid(12, 8);
    expect(toggleTower(grid, -1, 0)).toBe(grid);
    expect(toggleTower(grid, 12, 0)).toBe(grid);
    expect(toggleTower(grid, 0, 8)).toBe(grid);
  });
});

describe("removeTower", () => {
  it("clears a placed tower and leaves an empty tile", () => {
    const placed = toggleTower(createGrid(12, 8), 4, 2);
    const cleared = removeTower(placed, 4, 2);
    expect(hasTower(cleared, 4, 2)).toBe(false);
    expect(tileKind(cleared, 4, 2)).toBe("empty");
    expect(removeTower(createGrid(12, 8), 4, 2).towers).toEqual([]);
  });
});

describe("placeTower and construction", () => {
  it("places a building tower that still occupies the tile", () => {
    const next = placeTower(createGrid(12, 8), 2, 3, "cannon", BUILD_DURATION_SEC);
    const tower = getTower(next, 2, 3);
    expect(tower?.typeId).toBe("cannon");
    expect(tower?.buildTimeLeft).toBe(BUILD_DURATION_SEC);
    expect(tileKind(next, 2, 3)).toBe("tower");
  });

  it("counts construction down until the tower is finished", () => {
    let grid = placeTower(createGrid(12, 8), 2, 3, "mage", 0.4);
    grid = advanceTowerBuilds(grid, 0.25);
    expect(getTower(grid, 2, 3)?.buildTimeLeft).toBeCloseTo(0.15, 5);
    grid = advanceTowerBuilds(grid, 0.2);
    expect(getTower(grid, 2, 3)?.buildTimeLeft).toBe(0);
  });

  it("upgrades a finished tower and raises its max HP", () => {
    const placed = toggleTower(createGrid(12, 8), 4, 2);
    const upgraded = upgradeTower(placed, 4, 2);
    expect(getTower(upgraded, 4, 2)?.level).toBe(2);
    expect(getTower(upgraded, 4, 2)?.hp).toBeGreaterThan(TOWER_MAX_HP);
    expect(getTower(upgraded, 4, 2)?.buildTimeLeft).toBe(UPGRADE_DURATION_SEC);
    expect(upgradeTower(placeTower(createGrid(12, 8), 4, 2, "archer", 1), 4, 2).towers[0]?.level).toBe(
      1,
    );
  });
});

describe("damageTower", () => {
  it("lowers HP and removes the tower at 0", () => {
    const placed = toggleTower(createGrid(12, 8), 2, 3);
    const damaged = damageTower(placed, 2, 3, 3);
    expect(getTower(damaged, 2, 3)?.hp).toBe(TOWER_MAX_HP - 3);
    expect(hasTower(damaged, 2, 3)).toBe(true);

    const gone = damageTower(damaged, 2, 3, TOWER_MAX_HP);
    expect(hasTower(gone, 2, 3)).toBe(false);
    expect(tileKind(gone, 2, 3)).toBe("empty");
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

describe("viewportToTile", () => {
  it("maps a pixel inside a tile to that tile", () => {
    const layout = fitGridToViewport(createGrid(10, 5), 1000, 400, 0);
    expect(viewportToTile(layout, 100 + 40, 40)).toEqual({ x: 0, y: 0 });
    expect(viewportToTile(layout, 100 + 80 + 1, 80 + 1)).toEqual({ x: 1, y: 1 });
    expect(viewportToTile(layout, 100 + 799, 399)).toEqual({ x: 9, y: 4 });
  });

  it("returns null outside the grid", () => {
    const layout = fitGridToViewport(createGrid(10, 5), 1000, 400, 0);
    expect(viewportToTile(layout, 99, 0)).toBeNull();
    expect(viewportToTile(layout, 100 + 800, 0)).toBeNull();
    expect(viewportToTile(layout, 100, -1)).toBeNull();
  });
});
