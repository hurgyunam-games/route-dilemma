import { describe, expect, it } from "vitest";
import { createGrid, getObstacle, getTower, hasObstacle, hasTower, placeTower, toggleTower, TOWER_MAX_HP, obstacleMaxHp, upgradeTower } from "./grid";
import { createMapGrid } from "./maps";
import { findPath } from "./path";
import {
  ALLY_GOLD_REWARD,
  BASE_MAX_HP,
  START_GOLD,
  START_GOLD_PER_STAGE,
  startingGold,
  BUILD_DURATION_SEC,
  createSim,
  ENEMY_BASE_DAMAGE,
  hudSnapshot,
  PHASE_DURATION_SEC,
  SPAWN_INTERVAL_SEC,
  setTimeScale,
  simBeginBuild,
  simRemoveTower,
  simToggleTower,
  simUpgradeTower,
  tick,
  TOWER_ATTACK_DPS,
  TOWER_FIRE_INTERVAL_SEC,
  TOWER_RANGE_TILES,
  UNIT_ATTACK_DPS,
  UNIT_MAX_HP,
  UNIT_SPEED_TILES_PER_SEC,
  unitTile,
  allySpawnDurationSec,
  enemySpawnDurationSec,
  getStageWave,
  PHASE_TAIL_SEC,
  towerBuildCost,
  towerDps,
  towerRange,
  towerUpgradeCost,
  TOWER_TYPE_IDS,
  UPGRADE_DURATION_SEC,
  BATTLE_WAVE_COUNT,
} from "./sim";

function wallColumn(grid: ReturnType<typeof createGrid>, x: number) {
  let next = grid;
  for (let y = 0; y < grid.rows; y += 1) {
    next = toggleTower(next, x, y);
  }
  return next;
}

function obstacleColumn(
  grid: ReturnType<typeof createGrid>,
  x: number,
  kind: "rock" | "tree" = "rock",
) {
  return {
    ...grid,
    obstacles: Array.from({ length: grid.rows }, (_, y) => ({
      x,
      y,
      kind,
      hp: obstacleMaxHp(kind),
    })),
  };
}

const STAGE_1 = getStageWave(1);

describe("createSim", () => {
  it("spawns a unit on Start", () => {
    const sim = createSim();
    expect(sim.units).toHaveLength(1);
    expect(sim.units[0]!.kind).toBe("enemy");
    expect(unitTile(sim.units[0]!)).toEqual(sim.grid.start);
    expect(sim.gold).toBe(START_GOLD);
    expect(sim.baseHp).toBe(BASE_MAX_HP);
    expect(sim.units[0]!.hp).toBe(getStageWave(1).bursts[0]!.units[0]!.hp);
    expect(sim.towerShots).toEqual([]);
    expect(sim.outcome).toBe("playing");
    expect(sim.waveIndex).toBe(0);
    expect(sim.waveCount).toBe(BATTLE_WAVE_COUNT);
  });

  it("uses the chosen map Start tile", () => {
    const grid = createMapGrid(4);
    const sim = createSim(grid);
    expect(sim.grid.start).toEqual(grid.start);
    expect(sim.grid.base).toEqual(grid.base);
    expect(sim.grid.obstacles).toEqual(grid.obstacles);
    expect(sim.grid.obstacles.length).toBeGreaterThan(0);
    expect(unitTile(sim.units[0]!)).toEqual(grid.start);
    expect(sim.grid.start).not.toEqual(createGrid().start);
  });

  it("uses the chosen stage wave so later stages spawn tougher enemies", () => {
    const stage1 = getStageWave(1);
    const stage5 = getStageWave(5);
    const sim = createSim(createMapGrid(5), 5);
    expect(sim.stageId).toBe(5);
    expect(sim.units[0]!.hp).toBe(stage5.bursts[0]!.units[0]!.hp);
    expect(sim.phaseTimeLeft).toBe(stage5.enemyPhaseSec);
    expect(stage5.bursts[0]!.units[0]!.hp).toBeGreaterThan(stage1.bursts[0]!.units[0]!.hp);
    expect(stage5.bursts.reduce((sum, burst) => sum + burst.units.length, 0)).toBeGreaterThan(
      stage1.bursts.reduce((sum, burst) => sum + burst.units.length, 0),
    );
  });
});

describe("stage starting gold", () => {
  const cheapest = Math.min(...TOWER_TYPE_IDS.map((id) => towerBuildCost(id)));

  it("gives stage 1 a different starting gold than later stages", () => {
    expect(createSim(createGrid(), 1).gold).toBe(START_GOLD);
    expect(createSim(createGrid(), 3).gold).not.toBe(START_GOLD);
    expect(startingGold(3)).toBe(START_GOLD + START_GOLD_PER_STAGE * 2);
  });

  it("gives later stages more starting gold than earlier ones", () => {
    expect(startingGold(2)).toBeGreaterThan(startingGold(1));
    expect(startingGold(3)).toBeGreaterThan(startingGold(2));
    expect(startingGold(5)).toBeGreaterThan(startingGold(3));
    expect(createSim(createGrid(), 5).gold).toBeGreaterThan(createSim(createGrid(), 1).gold);
  });

  it("gives the same starting gold when re-entering a stage", () => {
    expect(createSim(createGrid(), 4).gold).toBe(createSim(createGrid(), 4).gold);
    expect(startingGold(6)).toBe(startingGold(6));
  });

  it("cannot fill the map with starting gold; ally rewards are still needed", () => {
    for (const stageId of [1, 3, 5, 10, 20]) {
      const sim = createSim(createGrid(12, 8), stageId);
      const empty =
        sim.grid.cols * sim.grid.rows - 2 - sim.grid.obstacles.length - sim.grid.towers.length;
      const maxBuy = Math.floor(sim.gold / cheapest);
      expect(maxBuy).toBeGreaterThan(0);
      expect(maxBuy).toBeLessThan(empty);
      expect(sim.gold - maxBuy * cheapest).toBeLessThan(cheapest);
    }
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

describe("blocked path obstacle breaking", () => {
  it("attacks a chokepoint obstacle and lowers its HP", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: obstacleColumn(sim.grid, 1) };
    const target = { x: 1, y: sim.grid.start.y };
    const max = obstacleMaxHp("rock");
    expect(getObstacle(sim.grid, target.x, target.y)?.hp).toBe(max);
    expect(findPath(sim.grid)).toBeNull();

    sim = tick(sim, 0.5);
    const hp = getObstacle(sim.grid, target.x, target.y)?.hp;
    expect(hp).toBeDefined();
    expect(hp!).toBeLessThan(max);
    expect(hp!).toBeCloseTo(max - UNIT_ATTACK_DPS * 0.5, 5);
    expect(sim.units[0]!.attackTile).toEqual(target);
  });

  it("outlasts a level-1 tower under the same attack", () => {
    const towerTime = TOWER_MAX_HP / UNIT_ATTACK_DPS;
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: obstacleColumn(sim.grid, 1, "tree") };
    const target = { x: 1, y: sim.grid.start.y };
    expect(obstacleMaxHp("tree")).toBeGreaterThan(TOWER_MAX_HP);

    sim = tick(sim, towerTime + 0.05);
    expect(hasObstacle(sim.grid, target.x, target.y)).toBe(true);
    expect(getObstacle(sim.grid, target.x, target.y)!.hp).toBeGreaterThan(0);
    expect(findPath(sim.grid)).toBeNull();
  });

  it("clears the tile at 0 HP and redraws the path", () => {
    let sim = createSim(createGrid(12, 8));
    sim = { ...sim, grid: obstacleColumn(sim.grid, 1, "tree") };
    const target = { x: 1, y: sim.grid.start.y };
    expect(findPath(sim.grid)).toBeNull();

    sim = advance(sim, obstacleMaxHp("tree") / UNIT_ATTACK_DPS + 0.05);
    expect(hasObstacle(sim.grid, target.x, target.y)).toBe(false);
    expect(findPath(sim.grid)).not.toBeNull();
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
    expect(hud.stageId).toBe(1);
  });

  it("counts remaining phase time down", () => {
    const sim = tick(createSim(), 1.25);
    expect(sim.phase).toBe("enemy");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_DURATION_SEC - 1.25, 5);
    expect(hudSnapshot(sim).phaseTimeLeft).toBe(sim.phaseTimeLeft);
  });

  it("flips to Ally Phase and restarts the timer at 0", () => {
    const sim = advance(createSim(), STAGE_1.enemyPhaseSec);
    expect(sim.phase).toBe("ally");
    expect(sim.phaseTimeLeft).toBeCloseTo(STAGE_1.allyPhaseSec, 5);
  });

  it("flips back to Enemy Phase on the next timeout", () => {
    const sim = advance(
      createSim(),
      STAGE_1.enemyPhaseSec + STAGE_1.allyPhaseSec + 0.4,
    );
    expect(sim.phase).toBe("enemy");
    expect(sim.phaseTimeLeft).toBeCloseTo(STAGE_1.enemyPhaseSec - 0.4, 5);
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
    expect(sim.gold).toBe(START_GOLD);
    expect(hudSnapshot(sim).gold).toBe(START_GOLD);
  });

  it("does not increase gold while the ally is still walking", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = tick(sim, 1.2);
    expect(sim.units[0]!.kind).toBe("ally");
    expect(sim.units[0]!.x).toBeGreaterThan(sim.grid.start.x + 2);
    expect(unitTile(sim.units[0]!)).not.toEqual(sim.grid.base);
    expect(sim.gold).toBe(START_GOLD);
  });

  it("increases gold only after the ally reaches Base", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    sim = advance(sim, 4.2);
    expect(sim.gold).toBe(START_GOLD + ALLY_GOLD_REWARD);
    expect(hudSnapshot(sim).gold).toBe(START_GOLD + ALLY_GOLD_REWARD);
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
    expect(sim.gold).toBe(START_GOLD);
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
    expect(sim.gold).toBe(START_GOLD);
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
    expect(sim.gold).toBe(START_GOLD + ALLY_GOLD_REWARD);
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(false);
  });

  it("pays no gold when a leftover ally is caught by an enemy", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    expect(sim.phase).toBe("ally");
    sim = { ...sim, grid: wallColumn(sim.grid, 1) };
    const allyId = sim.units[0]!.id;
    expect(sim.gold).toBe(START_GOLD);

    sim = advance(sim, sim.phaseTimeLeft + 0.05);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.id === allyId)).toBe(false);
    expect(sim.units.some((unit) => unit.kind === "enemy")).toBe(true);
    expect(sim.gold).toBe(START_GOLD);
  });

  it("pays no gold when a leftover ally times out still on the map", () => {
    let sim = advance(createSim(createGrid(12, 8)), PHASE_DURATION_SEC);
    const ally = sim.units[0]!;
    sim = simToggleTower(sim, 1, 0);
    sim = simToggleTower(sim, 0, 1);
    sim = {
      ...sim,
      units: [{ ...ally, x: 0, y: 0 }],
      burstIndex: 99,
      spawnedInBurst: 99,
      baseHp: BASE_MAX_HP,
    };

    sim = advance(sim, sim.phaseTimeLeft + 0.05);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(true);
    expect(sim.gold).toBe(START_GOLD);

    sim = advance(sim, sim.phaseTimeLeft + 0.05);
    expect(sim.phase).toBe("ally");
    expect(sim.units.some((unit) => unit.id === ally.id)).toBe(false);
    expect(sim.gold).toBe(START_GOLD);
  });

  it("still has the ally on the map after Ally Phase when the maze is long", () => {
    const simGrid = createGrid(50, 8);
    const path = findPath(simGrid)!;
    expect(path.length - 1).toBeGreaterThan(UNIT_SPEED_TILES_PER_SEC * STAGE_1.allyPhaseSec);

    let sim = createSim(simGrid);
    sim = advance(sim, STAGE_1.enemyPhaseSec);
    expect(sim.phase).toBe("ally");
    sim = advance(sim, STAGE_1.allyPhaseSec);
    expect(sim.phase).toBe("enemy");
    expect(sim.units.some((unit) => unit.kind === "ally")).toBe(true);
    expect(sim.gold).toBe(START_GOLD);
    expect(hudSnapshot(sim).leftoverAllies).toBeGreaterThan(0);
  });

  it("leaves only a short wait after the last enemy spawns", () => {
    const sim = advance(createSim(), enemySpawnDurationSec(STAGE_1));
    expect(sim.phase).toBe("enemy");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_TAIL_SEC, 1);
  });

  it("leaves only a short wait after the last ally spawns", () => {
    let sim = advance(createSim(), STAGE_1.enemyPhaseSec);
    expect(sim.phase).toBe("ally");
    sim = advance(sim, allySpawnDurationSec(STAGE_1));
    expect(sim.phase).toBe("ally");
    expect(sim.phaseTimeLeft).toBeCloseTo(PHASE_TAIL_SEC, 1);
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
  it("damages an in-range enemy after a projectile lands", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, sim.grid.start.x, sim.grid.start.y + 1);
    sim = tick(sim, 0.05);
    const enemy = sim.units[0]!;
    expect(enemy.kind).toBe("enemy");
    expect(sim.towerShots).toHaveLength(1);
    expect(sim.towerShots[0]).toMatchObject({
      fromX: sim.grid.start.x,
      fromY: sim.grid.start.y + 1,
      typeId: "archer",
    });
    expect(sim.towerShots[0]!.x).toBeCloseTo(sim.grid.start.x, 1);
    sim = tick(sim, 0.3);
    const hit = sim.units[0]!;
    expect(hit.id).toBe(enemy.id);
    expect(hit.hp).toBeCloseTo(
      STAGE_1.bursts[0]!.units[0]!.hp - TOWER_ATTACK_DPS * TOWER_FIRE_INTERVAL_SEC,
      5,
    );
  });

  it("removes an enemy when HP reaches 0", () => {
    let sim = createSim(createGrid(12, 8));
    const id = sim.units[0]!.id;
    const lane = sim.grid.start.y + 1;
    for (let x = 1; x <= 9; x += 1) {
      sim = simToggleTower(sim, x, lane);
    }
    sim = { ...sim, burstIndex: 99, spawnedInBurst: 99 };

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
    expect(enemy.hp).toBe(STAGE_1.bursts[0]!.units[0]!.hp);
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

  it("lets a cannon splash hit a second nearby enemy", () => {
    let sim = createSim(createGrid(12, 8));
    const first = sim.units[0]!;
    sim = {
      ...sim,
      grid: placeTower(sim.grid, sim.grid.start.x, sim.grid.start.y + 1, "cannon", 0),
      units: [first, { ...first, id: 99, x: first.x + 0.6, y: first.y }],
      burstIndex: 99,
      spawnedInBurst: 99,
      nextUnitId: 100,
    };
    sim = tick(sim, 0.25);
    const enemies = sim.units.filter((unit) => unit.kind === "enemy");
    expect(enemies).toHaveLength(2);
    expect(enemies[0]!.hp).toBeLessThan(first.hp);
    expect(enemies[1]!.hp).toBeLessThan(first.hp);
  });

  it("lets a mage slow the enemy it hits", () => {
    let sim = createSim(createGrid(12, 8));
    sim = {
      ...sim,
      grid: placeTower(sim.grid, sim.grid.start.x, sim.grid.start.y + 1, "mage", 0),
    };
    sim = tick(sim, 0.35);
    const enemy = sim.units[0]!;
    expect(enemy.slowLeft).toBeGreaterThan(0);
    expect(enemy.slowFactor).toBeLessThan(1);
  });

  it("does not let a wall fire even when an enemy is adjacent", () => {
    let sim = createSim(createGrid(12, 8));
    sim = {
      ...sim,
      grid: placeTower(sim.grid, sim.grid.start.x, sim.grid.start.y + 1, "wall", 0),
    };
    sim = tick(sim, 0.25);
    const enemy = sim.units[0]!;
    expect(enemy.kind).toBe("enemy");
    expect(enemy.hp).toBe(STAGE_1.bursts[0]!.units[0]!.hp);
    expect(sim.towerShots).toHaveLength(0);
  });
});

describe("wave spawn", () => {
  it("spawns several enemies during Enemy Phase, not just one", () => {
    const n = 4;
    const sim = tick(
      createSim(createGrid(12, 8)),
      SPAWN_INTERVAL_SEC * (n - 1) + 0.05,
    );
    expect(sim.phase).toBe("enemy");
    expect(sim.units.filter((unit) => unit.kind === "enemy")).toHaveLength(n);
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
    expect(sim.gold).toBe(START_GOLD);

    sim = advance(
      createSim(createGrid(12, 8)),
      PHASE_DURATION_SEC + 11 / UNIT_SPEED_TILES_PER_SEC + SPAWN_INTERVAL_SEC + 0.3,
    );
    expect(sim.phase).toBe("ally");
    expect(sim.gold).toBe(START_GOLD + ALLY_GOLD_REWARD * 2);
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

describe("build cost and construction", () => {
  it("does not place a tower when gold is short and explains why", () => {
    const sim = { ...createSim(createGrid(12, 8)), gold: 0 };
    expect(sim.gold).toBe(0);
    const result = simBeginBuild(sim, 3, 2, "archer");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("골드가 부족합니다");
      expect(result.reason).toContain("필요 10");
    }
    expect(hasTower(sim.grid, 3, 2)).toBe(false);
  });

  it("spends gold and starts construction when a type is chosen", () => {
    let sim = { ...createSim(createGrid(12, 8)), gold: 10 };
    const x = 3;
    const y = sim.grid.start.y;
    const result = simBeginBuild(sim, x, y, "archer");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    sim = result.state;
    expect(sim.gold).toBe(0);
    const tower = getTower(sim.grid, x, y);
    expect(tower?.typeId).toBe("archer");
    expect(tower?.buildTimeLeft).toBe(BUILD_DURATION_SEC);
    expect(findPath(sim.grid)?.some((tile) => tile.x === x && tile.y === y)).toBe(false);
  });

  it("does not attack until construction finishes", () => {
    let sim = { ...createSim(createGrid(12, 8)), gold: 10 };
    const built = simBeginBuild(sim, sim.grid.start.x, sim.grid.start.y + 1, "archer");
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    sim = built.state;
    sim = tick(sim, 0.25);
    const enemy = sim.units[0]!;
    expect(enemy.kind).toBe("enemy");
    expect(enemy.hp).toBe(STAGE_1.bursts[0]!.units[0]!.hp);
    expect(sim.towerShots).toHaveLength(0);
    expect(getTower(sim.grid, sim.grid.start.x, sim.grid.start.y + 1)?.buildTimeLeft).toBeGreaterThan(
      0,
    );
  });

  it("attacks after the build timer ends", () => {
    let sim = { ...createSim(createGrid(12, 8)), gold: 10 };
    const x = 4;
    const y = sim.grid.start.y + 1;
    const built = simBeginBuild(sim, x, y, "archer");
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    sim = tick(built.state, BUILD_DURATION_SEC + 0.05);
    expect(getTower(sim.grid, x, y)?.buildTimeLeft).toBe(0);
    expect(sim.towerShots.length).toBeGreaterThan(0);
    sim = tick(sim, 0.35);
    expect(sim.units[0]!.hp).toBeLessThan(STAGE_1.bursts[0]!.units[0]!.hp);
  });

  it("cannot buy two archers with one ally delivery", () => {
    let sim = { ...createSim(createGrid(12, 8)), gold: ALLY_GOLD_REWARD };
    const first = simBeginBuild(sim, 3, 2, "archer");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    sim = first.state;
    const second = simBeginBuild(sim, 4, 2, "archer");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toContain("골드가 부족합니다");
    }
    expect(hasTower(sim.grid, 4, 2)).toBe(false);
  });

  it("upgrades a finished tower, spending gold and raising combat stats", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, sim.grid.start.x, sim.grid.start.y + 1);
    sim = { ...sim, gold: 20 };
    const before = getTower(sim.grid, sim.grid.start.x, sim.grid.start.y + 1)!;
    const result = simUpgradeTower(sim, before.x, before.y);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    sim = result.state;
    const after = getTower(sim.grid, before.x, before.y)!;
    expect(sim.gold).toBe(20 - towerUpgradeCost(before));
    expect(after.level).toBe(2);
    expect(after.buildTimeLeft).toBe(UPGRADE_DURATION_SEC);
    expect(towerRange(after)).toBeGreaterThan(towerRange(before));
    expect(towerDps(after)).toBeGreaterThan(towerDps(before));
  });

  it("upgrades a wall by raising HP without giving it an attack", () => {
    let sim = createSim(createGrid(12, 8));
    const x = 3;
    const y = 2;
    sim = { ...sim, grid: placeTower(sim.grid, x, y, "wall", 0), gold: 20 };
    const before = getTower(sim.grid, x, y)!;
    const result = simUpgradeTower(sim, x, y);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    sim = result.state;
    const after = getTower(sim.grid, x, y)!;
    expect(after.level).toBe(2);
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(towerDps(after)).toBe(0);
    expect(towerRange(after)).toBe(0);
    sim = tick(sim, UPGRADE_DURATION_SEC + 0.25);
    expect(sim.towerShots).toHaveLength(0);
  });

  it("does not attack while an upgrade is still playing", () => {
    let sim = createSim(createGrid(12, 8));
    const x = sim.grid.start.x;
    const y = sim.grid.start.y + 1;
    sim = simToggleTower(sim, x, y);
    sim = { ...sim, gold: 20 };
    const upgraded = simUpgradeTower(sim, x, y);
    expect(upgraded.ok).toBe(true);
    if (!upgraded.ok) {
      return;
    }
    sim = tick(upgraded.state, 0.25);
    expect(getTower(sim.grid, x, y)?.level).toBe(2);
    expect(getTower(sim.grid, x, y)?.buildTimeLeft).toBeGreaterThan(0);
    expect(sim.towerShots).toHaveLength(0);
  });

  it("rejects an upgrade when gold is short", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, 3, 2);
    const result = simUpgradeTower({ ...sim, gold: 0 }, 3, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("골드가 부족합니다");
    }
    expect(getTower(sim.grid, 3, 2)?.level).toBe(1);
  });

  it("still starts a paid build while paused", () => {
    let sim = setTimeScale({ ...createSim(), gold: 10 }, 0);
    const result = simBeginBuild(sim, 3, 2, "archer");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    sim = tick(result.state, 1);
    expect(hasTower(sim.grid, 3, 2)).toBe(true);
    expect(getTower(sim.grid, 3, 2)?.buildTimeLeft).toBe(BUILD_DURATION_SEC);
    expect(sim.gold).toBe(0);
  });

  it("lets the player remove a tower without changing gold", () => {
    let sim = createSim(createGrid(12, 8));
    sim = simToggleTower(sim, 3, 2);
    const gold = sim.gold;
    const result = simRemoveTower(sim, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    sim = result.state;
    expect(hasTower(sim.grid, 3, 2)).toBe(false);
    expect(sim.gold).toBe(gold);
    expect(findPath(sim.grid)).not.toBeNull();
  });

  it("explains when there is no tower to remove", () => {
    const result = simRemoveTower(createSim(createGrid(12, 8)), 3, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("타워가 없습니다");
    }
  });

  it("does not build or remove a natural obstacle", () => {
    const grid = createGrid(12, 8, undefined, undefined, [{ kind: "rock", x: 3, y: 2 }]);
    const sim = { ...createSim(grid), gold: START_GOLD };
    expect(hasObstacle(sim.grid, 3, 2)).toBe(true);
    const built = simBeginBuild(sim, 3, 2, "archer");
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.reason).toContain("여기에 지을 수 없습니다");
    }
    const removed = simRemoveTower(sim, 3, 2);
    expect(removed.ok).toBe(false);
    expect(hasObstacle(sim.grid, 3, 2)).toBe(true);
    expect(hasTower(sim.grid, 3, 2)).toBe(false);
  });
});

function leakIntoBase(sim: ReturnType<typeof createSim>, hp = 1): ReturnType<typeof createSim> {
  const enemy = sim.units.find((unit) => unit.kind === "enemy") ?? sim.units[0]!;
  return {
    ...sim,
    baseHp: hp,
    burstIndex: 99,
    spawnedInBurst: 99,
    units: [{ ...enemy, x: sim.grid.base.x - 0.05, y: sim.grid.base.y }],
  };
}

function lastWaveEmpty(sim: ReturnType<typeof createSim>): ReturnType<typeof createSim> {
  const stage = getStageWave(sim.stageId);
  return {
    ...sim,
    waveIndex: sim.waveCount - 1,
    burstIndex: stage.bursts.length,
    spawnedInBurst: 0,
    spawnCooldown: 1,
    units: [],
    towerShots: [],
  };
}

describe("battle outcome", () => {
  it("stops the battle and reports Game Over when base HP hits 0", () => {
    let sim = leakIntoBase(createSim(createGrid(12, 8)));
    sim = tick(sim, 0.2);
    expect(sim.baseHp).toBe(0);
    expect(sim.outcome).toBe("defeat");
    expect(hudSnapshot(sim).outcome).toBe("defeat");
  });

  it("does not spawn more enemies or allies after Game Over", () => {
    let sim = leakIntoBase(createSim(createGrid(12, 8)));
    sim = tick(sim, 0.2);
    expect(sim.outcome).toBe("defeat");

    const frozen = {
      units: sim.units.map((unit) => ({ id: unit.id, x: unit.x, y: unit.y, kind: unit.kind })),
      nextUnitId: sim.nextUnitId,
      phase: sim.phase,
      phaseTimeLeft: sim.phaseTimeLeft,
      time: sim.time,
    };

    sim = tick(sim, 2);
    expect(sim.outcome).toBe("defeat");
    expect(sim.nextUnitId).toBe(frozen.nextUnitId);
    expect(sim.phase).toBe(frozen.phase);
    expect(sim.phaseTimeLeft).toBe(frozen.phaseTimeLeft);
    expect(sim.time).toBe(frozen.time);
    expect(
      sim.units.map((unit) => ({ id: unit.id, x: unit.x, y: unit.y, kind: unit.kind })),
    ).toEqual(frozen.units);
  });

  it("reports Victory after the last wave is cleared with the base still up", () => {
    let sim = lastWaveEmpty(createSim(createGrid(12, 8)));
    expect(sim.baseHp).toBeGreaterThan(0);
    sim = tick(sim, 0.05);
    expect(sim.outcome).toBe("victory");
    expect(hudSnapshot(sim).outcome).toBe("victory");
    expect(sim.units.some((unit) => unit.kind === "enemy")).toBe(false);
  });

  it("does not spawn after Victory", () => {
    let sim = lastWaveEmpty(createSim(createGrid(12, 8)));
    sim = tick(sim, 0.05);
    expect(sim.outcome).toBe("victory");
    const nextUnitId = sim.nextUnitId;
    sim = tick(sim, 2);
    expect(sim.outcome).toBe("victory");
    expect(sim.nextUnitId).toBe(nextUnitId);
    expect(sim.units.some((unit) => unit.kind === "enemy")).toBe(false);
  });

  it("does not start Ally Phase or spawn allies after the last wave timer", () => {
    const started = createSim(createGrid(12, 8));
    const enemy = started.units[0]!;
    let sim: ReturnType<typeof createSim> = {
      ...started,
      waveIndex: started.waveCount - 1,
      burstIndex: getStageWave(1).bursts.length,
      spawnedInBurst: 0,
      spawnCooldown: 1,
      phaseTimeLeft: 0.05,
      units: [{ ...enemy, x: 5, y: started.grid.start.y }],
    };
    sim = tick(sim, 0.2);
    expect(sim.phase).toBe("enemy");
    expect(sim.outcome).toBe("playing");
    expect(sim.units.some((unit) => unit.kind === "ally")).toBe(false);
    expect(sim.units.some((unit) => unit.id === enemy.id)).toBe(true);
  });

  it("does not declare Victory before the last wave is finished", () => {
    let sim = createSim(createGrid(12, 8));
    sim = {
      ...sim,
      burstIndex: getStageWave(1).bursts.length,
      spawnedInBurst: 0,
      units: [],
      towerShots: [],
    };
    sim = tick(sim, 0.05);
    expect(sim.waveIndex).toBe(0);
    expect(sim.outcome).toBe("playing");
  });

  it("repeats the same leak as defeat and the same clear as victory", () => {
    const lost = () => tick(leakIntoBase(createSim(createGrid(12, 8))), 0.2);
    const won = () => tick(lastWaveEmpty(createSim(createGrid(12, 8))), 0.05);
    expect(lost().outcome).toBe("defeat");
    expect(lost().outcome).toBe("defeat");
    expect(won().outcome).toBe("victory");
    expect(won().outcome).toBe("victory");
  });
});

function finishTowers(grid: ReturnType<typeof createGrid>) {
  return {
    ...grid,
    towers: grid.towers.map((tower) => ({ ...tower, buildTimeLeft: 0 })),
  };
}

function modestLoopDefense(grid: ReturnType<typeof createGrid>) {
  let next = grid;
  for (const [x, y] of [
    [4, 2],
    [5, 2],
    [6, 2],
    [4, 4],
    [5, 4],
  ] as const) {
    next = placeTower(next, x, y, "archer", 0);
  }
  return next;
}

function reinforceLoopDefense(grid: ReturnType<typeof createGrid>) {
  let next = modestLoopDefense(grid);
  for (const tower of next.towers) {
    next = finishTowers(upgradeTower(next, tower.x, tower.y));
    next = finishTowers(upgradeTower(next, tower.x, tower.y));
    next = finishTowers(upgradeTower(next, tower.x, tower.y));
    next = finishTowers(upgradeTower(next, tower.x, tower.y));
  }
  for (const [x, y] of [
    [3, 2],
    [3, 4],
    [7, 2],
    [7, 4],
    [8, 2],
    [8, 4],
  ] as const) {
    next = placeTower(next, x, y, "cannon", 0);
  }
  return next;
}

function playOut(sim: ReturnType<typeof createSim>) {
  let next = sim;
  for (let i = 0; i < 90 && next.outcome === "playing"; i += 1) {
    next = tick(next, 4);
  }
  return next;
}

describe("loop difficulty", () => {
  it("returns faster, tougher enemies than the previous cycle of the same map", () => {
    const grid = createGrid(12, 8);
    const first = createSim(grid, 1);
    const looped = createSim(grid, 6);
    expect(looped.units[0]!.hp).toBeGreaterThan(first.units[0]!.hp);
    expect(looped.units[0]!.speed).toBeGreaterThan(first.units[0]!.speed);
    const afterFirst = tick(first, 1);
    const afterLoop = tick(looped, 1);
    expect(afterLoop.units[0]!.x).toBeGreaterThan(afterFirst.units[0]!.x);
  });

  it("lets a cycle-1 line hold stage 1 but leak when the same line returns on stage 6", () => {
    const grid = modestLoopDefense(createGrid(12, 8));
    const held = playOut(createSim(grid, 1));
    const leaked = playOut(createSim(grid, 6));
    expect(held.outcome).toBe("victory");
    expect(leaked.outcome).toBe("defeat");
    expect(leaked.baseHp).toBe(0);
  });

  it("holds the returned stage after adding and upgrading towers", () => {
    const grid = reinforceLoopDefense(createGrid(12, 8));
    const held = playOut(createSim(grid, 6));
    expect(held.outcome).toBe("victory");
    expect(held.baseHp).toBeGreaterThan(0);
  });
});
