<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import {
  canUpgrade,
  campaignCycle,
  combatCues,
  createBattleGrid,
  createSim,
  getGameMap,
  getTower,
  hudSnapshot,
  isTowerComplete,
  setTimeScale,
  simBeginBuild,
  simRemoveTower,
  simUpgradeTower,
  tileKind,
  tick,
  TOWER_ATTACK_LABELS,
  TOWER_CATALOG,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  towerAttack,
  towerDps,
  towerMaxHp,
  towerRange,
  towerRangePreview,
  towerUpgradeCost,
  type HudSnapshot,
  type MapId,
  type TimeScale,
  type Tower,
  type TowerTypeId,
} from "@/core";
import {
  createGameApp,
  destroyGameApp,
  setGameView,
} from "@/render/create-game-app";
import { playCombatSfx, unlockCombatSfx } from "@/render/sfx";

const TIME_CONTROLS: readonly { scale: TimeScale; label: string }[] = [
  { scale: 0, label: "일시정지" },
  { scale: 1, label: "1배속" },
  { scale: 2, label: "2배속" },
  { scale: 3, label: "3배속" },
];

type Shop =
  | { readonly mode: "build"; readonly x: number; readonly y: number }
  | { readonly mode: "upgrade"; readonly x: number; readonly y: number };

const props = defineProps<{
  mapId: MapId;
  stageId: number;
  towers: readonly Tower[];
}>();

const emit = defineEmits<{
  leave: [];
  victory: [stageId: number];
  saveTowers: [towers: readonly Tower[]];
}>();

const makeBattle = () =>
  setTimeScale(createSim(createBattleGrid(props.mapId, props.towers), props.stageId), 0);

const hostRef = ref<HTMLElement | null>(null);
let sim = makeBattle();
let reportedVictory = false;
let lastTowerSave = JSON.stringify(sim.grid.towers);
const hud = ref<HudSnapshot>(hudSnapshot(sim));
const shop = ref<Shop | null>(null);
const shopError = ref("");
const towerMenuDetail = ref(false);
const leakPulse = ref(0);
const rewardPulse = ref(0);
const goldGain = ref(0);
const goldAnimating = ref(false);
const hpHit = ref(false);
let app: Application | null = null;
let raf = 0;
let lastTs = 0;
let goldGainTimer = 0;
let hpHitTimer = 0;

const phaseLabel = computed(() =>
  hud.value.phase === "enemy" ? "Enemy Phase" : "Ally Phase",
);
const phaseTimeLabel = computed(() => `${hud.value.phaseTimeLeft.toFixed(1)}s`);
const goldLabel = computed(() => `골드 ${hud.value.gold}`);
const baseHpLabel = computed(() => `본진 HP ${hud.value.baseHp}`);
const leftoverLabel = computed(() =>
  hud.value.leftoverAllies > 0 ? `남은 아군 ${hud.value.leftoverAllies}` : "",
);
const mapLabel = computed(() => `맵 ${props.mapId} ${getGameMap(props.mapId).name}`);
const stageLabel = computed(() => {
  const cycle = campaignCycle(hud.value.stageId);
  return cycle > 0
    ? `스테이지 ${hud.value.stageId} · 사이클 ${cycle + 1}`
    : `스테이지 ${hud.value.stageId}`;
});
const loopHint = computed(() =>
  campaignCycle(hud.value.stageId) > 0
    ? "이전 사이클보다 적이 강합니다. 타워를 보강하세요."
    : "",
);
const waveLabel = computed(
  () => `웨이브 ${hud.value.waveIndex + 1} / ${hud.value.waveCount}`,
);
const outcomeTitle = computed(() =>
  hud.value.outcome === "defeat" ? "Game Over" : "Victory",
);

const selectedTower = computed(() => {
  void hud.value;
  if (!shop.value) {
    return undefined;
  }
  return getTower(sim.grid, shop.value.x, shop.value.y);
});

const upgradePreview = computed(() => {
  const tower = selectedTower.value;
  if (!tower || !isTowerComplete(tower)) {
    return null;
  }
  const current = {
    range: towerRange(tower),
    dps: towerDps(tower),
    hp: towerMaxHp(tower),
    level: tower.level,
  };
  if (tower.level >= TOWER_MAX_LEVEL) {
    return { current, next: null, cost: 0 };
  }
  const nextTower = { ...tower, level: tower.level + 1 };
  return {
    current,
    next: {
      range: towerRange(nextTower),
      dps: towerDps(nextTower),
      hp: towerMaxHp(nextTower),
      level: nextTower.level,
    },
    cost: towerUpgradeCost(tower),
  };
});

const selectedTowerName = computed(() => {
  const tower = selectedTower.value;
  if (!tower) {
    return "";
  }
  return TOWER_DEFS[tower.typeId].name;
});

const canUpgradeSelected = computed(() => {
  const tower = selectedTower.value;
  return tower !== undefined && canUpgrade(tower);
});

const rangePreview = computed(() => {
  const tower = selectedTower.value;
  if (!tower) {
    return null;
  }
  return towerRangePreview(tower);
});

const selectedTile = computed(() => {
  const tower = selectedTower.value;
  if (!tower) {
    return null;
  }
  return { x: tower.x, y: tower.y };
});

const closeShop = (): void => {
  shop.value = null;
  shopError.value = "";
  towerMenuDetail.value = false;
  pushView();
};

const saveTowersIfChanged = (): void => {
  const raw = JSON.stringify(sim.grid.towers);
  if (raw === lastTowerSave) {
    return;
  }
  lastTowerSave = raw;
  emit("saveTowers", sim.grid.towers);
};

const pushHud = (): void => {
  hud.value = hudSnapshot(sim);
  if (hud.value.outcome === "victory" && !reportedVictory) {
    reportedVictory = true;
    emit("victory", props.stageId);
  }
  saveTowersIfChanged();
  if (shop.value?.mode === "upgrade" && !getTower(sim.grid, shop.value.x, shop.value.y)) {
    closeShop();
  }
};

const pushView = (): void => {
  if (app) {
    setGameView(
      app,
      sim.grid,
      sim.units,
      sim.towerShots,
      rangePreview.value,
      leakPulse.value,
      rewardPulse.value,
      selectedTile.value,
    );
  }
};

const onTimeScale = (scale: TimeScale): void => {
  if (hud.value.outcome !== "playing") {
    return;
  }
  const next = setTimeScale(sim, scale);
  if (next === sim) {
    return;
  }
  sim = next;
  pushHud();
};

const onRestart = (): void => {
  sim = makeBattle();
  reportedVictory = false;
  lastTowerSave = JSON.stringify(sim.grid.towers);
  leakPulse.value = 0;
  rewardPulse.value = 0;
  goldGain.value = 0;
  goldAnimating.value = false;
  hpHit.value = false;
  closeShop();
  pushHud();
  pushView();
};

const onLeaveWorldMap = (): void => {
  saveTowersIfChanged();
  emit("leave");
};

const onTileClick = (x: number, y: number): void => {
  if (hud.value.outcome !== "playing") {
    return;
  }
  const kind = tileKind(sim.grid, x, y);
  if (kind === "start" || kind === "base" || kind === "obstacle") {
    if (shop.value?.mode === "upgrade") {
      closeShop();
    }
    return;
  }
  shopError.value = "";
  if (kind === "empty") {
    shop.value = { mode: "build", x, y };
    towerMenuDetail.value = false;
    pushView();
    return;
  }
  if (shop.value?.mode === "upgrade" && shop.value.x === x && shop.value.y === y) {
    closeShop();
    return;
  }
  shop.value = { mode: "upgrade", x, y };
  towerMenuDetail.value = false;
  pushView();
};

const onPickType = (typeId: TowerTypeId): void => {
  if (!shop.value || shop.value.mode !== "build") {
    return;
  }
  const result = simBeginBuild(sim, shop.value.x, shop.value.y, typeId);
  if (!result.ok) {
    shopError.value = result.reason;
    return;
  }
  sim = result.state;
  closeShop();
  pushHud();
  pushView();
};

const onUpgrade = (): void => {
  if (!shop.value || shop.value.mode !== "upgrade") {
    return;
  }
  const result = simUpgradeTower(sim, shop.value.x, shop.value.y);
  if (!result.ok) {
    shopError.value = result.reason;
    return;
  }
  sim = result.state;
  shopError.value = "";
  towerMenuDetail.value = false;
  pushHud();
  pushView();
};

const onToggleDetail = (): void => {
  towerMenuDetail.value = !towerMenuDetail.value;
};

const onDestroy = (): void => {
  if (!shop.value || shop.value.mode !== "upgrade") {
    return;
  }
  if (!window.confirm("이 타워를 파괴할까요?")) {
    return;
  }
  const result = simRemoveTower(sim, shop.value.x, shop.value.y);
  if (!result.ok) {
    shopError.value = result.reason;
    return;
  }
  sim = result.state;
  closeShop();
  pushHud();
  pushView();
};

onMounted(async () => {
  if (!hostRef.value) {
    return;
  }
  app = await createGameApp(hostRef.value, sim.grid, sim.units, onTileClick);
  unlockCombatSfx();
  hostRef.value.addEventListener("pointerdown", unlockCombatSfx, { once: true });

  const loop = (ts: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = lastTs === 0 ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (dt > 0) {
      const prev = sim;
      sim = tick(sim, dt);
      const cues = combatCues(prev, sim);
      if (cues.leak) {
        leakPulse.value += 1;
        hpHit.value = true;
        window.clearTimeout(hpHitTimer);
        hpHitTimer = window.setTimeout(() => {
          hpHit.value = false;
        }, 280);
        playCombatSfx("leak");
      }
      if (cues.reward) {
        rewardPulse.value += 1;
        goldGain.value = cues.goldDelta;
        goldAnimating.value = false;
        requestAnimationFrame(() => {
          goldAnimating.value = true;
        });
        window.clearTimeout(goldGainTimer);
        goldGainTimer = window.setTimeout(() => {
          goldGain.value = 0;
          goldAnimating.value = false;
        }, 700);
        playCombatSfx("reward");
      }
      if (cues.collapse) {
        playCombatSfx("collapse");
      }
      if (cues.allyLost) {
        playCombatSfx("allyLost");
      }
      pushHud();
      pushView();
    }
  };
  raf = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.clearTimeout(goldGainTimer);
  window.clearTimeout(hpHitTimer);
  if (app) {
    destroyGameApp(app);
    app = null;
  }
});
</script>

<template>
  <div class="battle">
    <div
      ref="hostRef"
      class="canvas-host"
    />
    <div class="hud">
      <div class="hud-top">
        <button
          type="button"
          class="world-map-btn"
          @click="onLeaveWorldMap"
        >
          월드맵
        </button>
        <div class="hud-main">
          <div
            class="phase-bar"
            :class="hud.phase"
          >
            <span class="phase-name">{{ phaseLabel }}</span>
            <span class="phase-timer">{{ phaseTimeLabel }}</span>
          </div>
          <p
            class="gold"
            :class="{ pulse: goldAnimating }"
          >
            {{ goldLabel }}
            <span
              v-if="goldGain > 0"
              class="gold-gain"
            >+{{ goldGain }}</span>
          </p>
          <p
            class="base-hp"
            :class="{ hit: hpHit }"
          >
            {{ baseHpLabel }}
          </p>
        </div>
        <div
          class="time-controls"
          role="group"
          aria-label="타임 컨트롤러"
        >
          <button
            v-for="option in TIME_CONTROLS"
            :key="option.scale"
            type="button"
            :class="{ active: hud.timeScale === option.scale }"
            @click="onTimeScale(option.scale)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div class="hud-sub">
        <p class="meta">
          {{ mapLabel }} · {{ stageLabel }} · {{ waveLabel }}
        </p>
        <p
          v-if="loopHint"
          class="loop-hint"
        >
          {{ loopHint }}
        </p>
        <p
          v-if="leftoverLabel"
          class="leftover"
        >
          {{ leftoverLabel }}
        </p>
        <p
          v-if="!hud.hasPath"
          class="blocked"
        >
          길이 없습니다
        </p>
      </div>
    </div>
    <div
      v-if="hud.outcome !== 'playing'"
      class="outcome-overlay"
    >
      <div
        class="outcome-panel"
        :class="hud.outcome"
        role="dialog"
        aria-modal="true"
        :aria-label="outcomeTitle"
      >
        <h2>{{ outcomeTitle }}</h2>
        <div class="outcome-actions">
          <button
            type="button"
            class="restart-btn"
            @click="onRestart"
          >
            다시 하기
          </button>
          <button
            type="button"
            class="restart-btn"
            @click="onLeaveWorldMap"
          >
            월드맵
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="shop?.mode === 'build'"
      class="shop-overlay"
      @click.self="closeShop"
    >
      <div
        class="shop-panel"
        role="dialog"
        aria-modal="true"
        aria-label="건설할 종류 선택"
      >
        <header class="shop-head">
          <h2>건설할 종류 선택</h2>
          <button
            type="button"
            class="close"
            @click="closeShop"
          >
            닫기
          </button>
        </header>
        <p class="shop-gold">
          보유 골드 {{ hud.gold }}
        </p>
        <div class="type-grid">
          <button
            v-for="def in TOWER_CATALOG"
            :key="def.id"
            type="button"
            class="type-card"
            :class="def.id"
            @click="onPickType(def.id)"
          >
            <span class="type-name">{{ def.name }}</span>
            <span class="type-stat">비용 {{ def.cost }}</span>
            <span class="type-stat">체력 {{ def.hp }}</span>
            <template v-if="def.attack !== 'none'">
              <span class="type-stat">사거리 {{ def.range }}</span>
              <span class="type-stat">공격 {{ def.dps }} · {{ TOWER_ATTACK_LABELS[def.attack] }}</span>
            </template>
            <span
              v-else
              class="type-stat"
            >공격 없음 · 길 차단</span>
          </button>
        </div>
        <p
          v-if="shopError"
          class="shop-error"
        >
          {{ shopError }}
        </p>
      </div>
    </div>
    <div
      v-else-if="shop?.mode === 'upgrade' && selectedTower"
      class="tower-menu"
      :class="{ 'detail-open': towerMenuDetail }"
      role="dialog"
      aria-label="타워 메뉴"
    >
      <header class="shop-head">
        <h2>{{ selectedTowerName }}</h2>
        <button
          type="button"
          class="close"
          @click="closeShop"
        >
          닫기
        </button>
      </header>
      <div
        v-if="!isTowerComplete(selectedTower)"
        class="upgrade-body"
      >
        <p class="building-note">
          {{
            selectedTower.level > 1
              ? "업그레이드 중입니다. 끝난 뒤에 다시 업그레이드할 수 있습니다."
              : "아직 건설 중입니다. 완성된 뒤에 업그레이드할 수 있습니다."
          }}
        </p>
        <button
          type="button"
          class="destroy-btn"
          @click="onDestroy"
        >
          파괴
        </button>
      </div>
      <div
        v-else-if="upgradePreview"
        class="upgrade-body"
      >
        <div
          v-if="towerMenuDetail"
          class="tower-detail"
        >
          <p class="type-stat">
            레벨 {{ upgradePreview.current.level }}
            · 체력 {{ upgradePreview.current.hp }}
            <template v-if="selectedTower.typeId !== 'wall'">
              · 사거리 {{ upgradePreview.current.range }}
              · 공격 {{ upgradePreview.current.dps }}
              · {{ TOWER_ATTACK_LABELS[towerAttack(selectedTower)] }}
            </template>
            <template v-else>
              · 공격 없음
            </template>
          </p>
          <p
            v-if="upgradePreview.next"
            class="type-stat next"
          >
            다음: 레벨 {{ upgradePreview.next.level }}
            · 체력 {{ upgradePreview.next.hp }}
            <template v-if="selectedTower.typeId !== 'wall'">
              · 사거리 {{ upgradePreview.next.range }}
              · 공격 {{ upgradePreview.next.dps }}
            </template>
            · 비용 {{ upgradePreview.cost }}
          </p>
          <p
            v-else
            class="type-stat"
          >
            최대 레벨입니다
          </p>
        </div>
        <div class="shop-actions">
          <button
            v-if="canUpgradeSelected"
            type="button"
            class="upgrade-btn"
            @click="onUpgrade"
          >
            업그레이드
          </button>
          <button
            type="button"
            class="detail-btn"
            :class="{ active: towerMenuDetail }"
            :aria-pressed="towerMenuDetail"
            @click="onToggleDetail"
          >
            상세
          </button>
          <button
            v-if="towerMenuDetail"
            type="button"
            class="destroy-btn"
            @click="onDestroy"
          >
            파괴
          </button>
        </div>
      </div>
      <p
        v-if="shopError"
        class="shop-error"
      >
        {{ shopError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.battle {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas-host {
  position: absolute;
  inset: 0;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hud-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 0;
}

.hud-main {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
}

.hud-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px 0;
}

.phase-bar,
.gold,
.base-hp,
.leftover,
.loop-hint,
.blocked,
.meta {
  width: fit-content;
  margin: 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(20, 12, 10, 0.82);
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
}

.phase-bar {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.phase-bar.enemy {
  color: #f0b4a8;
  box-shadow: inset 0 0 0 1px rgba(232, 96, 72, 0.45);
}

.phase-bar.ally {
  color: #b8e0c8;
  box-shadow: inset 0 0 0 1px rgba(72, 176, 120, 0.45);
}

.phase-timer {
  font-variant-numeric: tabular-nums;
  opacity: 0.92;
}

.gold,
.base-hp,
.leftover,
.meta {
  font-variant-numeric: tabular-nums;
}

.meta {
  color: #d8cfc6;
  font-size: 12px;
  padding: 4px 8px;
}

.leftover {
  color: #b8e0c8;
}

.loop-hint {
  color: #e8b060;
  font-size: 12px;
  padding: 4px 8px;
}

.gold {
  color: #e8d48a;
}

.gold.pulse {
  animation: gold-in 0.45s ease-out;
}

.gold-gain {
  margin-left: 6px;
  color: #ffe9a8;
  font-weight: 800;
  animation: gold-gain-pop 0.7s ease-out;
}

.base-hp {
  color: #f0b4a8;
}

.base-hp.hit {
  animation: hp-hit 0.28s ease-out;
  box-shadow: inset 0 0 0 1px rgba(232, 96, 72, 0.8);
}

@keyframes gold-in {
  from {
    box-shadow: inset 0 0 0 1px rgba(232, 212, 138, 0.9);
    transform: scale(1.06);
  }
  to {
    box-shadow: inset 0 0 0 1px transparent;
    transform: scale(1);
  }
}

@keyframes gold-gain-pop {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@keyframes hp-hit {
  from {
    background: rgba(120, 24, 18, 0.92);
  }
  to {
    background: rgba(20, 12, 10, 0.82);
  }
}

.blocked {
  color: #f3d7c4;
}

.world-map-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(20, 12, 10, 0.82);
  color: #d8cfc6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: inset 0 0 0 1px rgba(216, 207, 198, 0.16);
}

.world-map-btn:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 2px;
}

.time-controls {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  pointer-events: auto;
}

.time-controls button {
  margin: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(20, 12, 10, 0.82);
  color: #d8cfc6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(216, 207, 198, 0.16);
}

.time-controls button.active {
  color: #f7efe6;
  background: rgba(56, 38, 28, 0.95);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.7);
}

.time-controls button:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 2px;
}

.shop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.55);
  pointer-events: auto;
}

.shop-panel {
  width: min(440px, calc(100% - 32px));
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.35);
  color: #f7efe6;
  font: 700 14px/1.4 "Segoe UI", sans-serif;
}

.shop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.shop-head h2 {
  margin: 0;
  font-size: 16px;
}

.close,
.upgrade-btn,
.detail-btn,
.destroy-btn {
  margin: 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(56, 38, 28, 0.95);
  color: #f7efe6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.55);
}

.shop-gold {
  margin: 0 0 12px;
  color: #e8d48a;
  font-variant-numeric: tabular-nums;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.type-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  background: rgba(20, 12, 10, 0.9);
  color: #f7efe6;
  font: 700 13px/1.3 "Segoe UI", sans-serif;
  text-align: left;
  cursor: pointer;
}

.type-card.archer {
  box-shadow: inset 0 0 0 2px #e8c090;
}

.type-card.melee {
  box-shadow: inset 0 0 0 2px #d09070;
}

.type-card.cannon {
  box-shadow: inset 0 0 0 2px #e07050;
}

.type-card.mage {
  box-shadow: inset 0 0 0 2px #88a0e8;
}

.type-card.wall {
  box-shadow: inset 0 0 0 2px #a8a090;
}

.type-name {
  margin: 0;
  font-size: 15px;
}

.type-stat {
  margin: 0;
  color: #d8cfc6;
  font-variant-numeric: tabular-nums;
}

.type-stat.next {
  color: #b8e0c8;
}

.upgrade-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.building-note {
  margin: 0;
  color: #f4d35e;
}

.shop-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.upgrade-btn,
.detail-btn {
  align-self: flex-start;
  padding: 8px 14px;
}

.destroy-btn {
  align-self: flex-start;
  padding: 8px 14px;
  color: #f0b4a8;
  box-shadow: inset 0 0 0 1px rgba(232, 96, 72, 0.55);
}

.shop-error {
  margin: 12px 0 0;
  color: #f0b4a8;
}

.tower-menu {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 2;
  width: fit-content;
  max-width: min(360px, calc(100% - 24px));
  padding: 10px 12px 12px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.94);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.35);
  color: #f7efe6;
  font: 700 13px/1.35 "Segoe UI", sans-serif;
  pointer-events: auto;
  transform: translateX(-50%);
}

.tower-menu.detail-open {
  width: min(360px, calc(100% - 24px));
}

.tower-menu .shop-head {
  margin-bottom: 8px;
}

.tower-menu .shop-head h2 {
  font-size: 14px;
}

.tower-menu .shop-error {
  margin: 8px 0 0;
}

.tower-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-btn.active {
  color: #f7efe6;
  box-shadow: inset 0 0 0 1px rgba(126, 200, 255, 0.85);
}

.outcome-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.62);
  pointer-events: auto;
}

.outcome-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(360px, calc(100% - 32px));
  padding: 28px 24px 24px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
  color: #f7efe6;
  text-align: center;
}

.outcome-panel.defeat {
  box-shadow: inset 0 0 0 1px rgba(232, 96, 72, 0.55);
}

.outcome-panel.victory {
  box-shadow: inset 0 0 0 1px rgba(72, 176, 120, 0.55);
}

.outcome-panel h2 {
  margin: 0;
  font: 700 28px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.04em;
}

.outcome-panel.defeat h2 {
  color: #f0b4a8;
}

.outcome-panel.victory h2 {
  color: #b8e0c8;
}

.outcome-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.restart-btn {
  margin: 0;
  padding: 10px 18px;
  border: 0;
  border-radius: 6px;
  background: rgba(56, 38, 28, 0.95);
  color: #f7efe6;
  font: 700 14px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.55);
}

.restart-btn:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 2px;
}
</style>
