<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import {
  createSim,
  hudSnapshot,
  setTimeScale,
  simToggleTower,
  tick,
  type HudSnapshot,
  type TimeScale,
} from "@/core";
import {
  createGameApp,
  destroyGameApp,
  setGameView,
} from "@/render/create-game-app";

const TIME_CONTROLS: readonly { scale: TimeScale; label: string }[] = [
  { scale: 0, label: "일시정지" },
  { scale: 1, label: "1배속" },
  { scale: 2, label: "2배속" },
  { scale: 3, label: "3배속" },
];

const hostRef = ref<HTMLElement | null>(null);
let sim = createSim();
const hud = ref<HudSnapshot>(hudSnapshot(sim));
let app: Application | null = null;
let raf = 0;
let lastTs = 0;

const phaseLabel = computed(() =>
  hud.value.phase === "enemy" ? "Enemy Phase" : "Ally Phase",
);
const phaseTimeLabel = computed(() => `${hud.value.phaseTimeLeft.toFixed(1)}s`);
const goldLabel = computed(() => `골드 ${hud.value.gold}`);
const baseHpLabel = computed(() => `본진 HP ${hud.value.baseHp}`);

const pushHud = (): void => {
  hud.value = hudSnapshot(sim);
};

const pushView = (): void => {
  if (app) {
    setGameView(app, sim.grid, sim.units, sim.towerShots);
  }
};

const onTimeScale = (scale: TimeScale): void => {
  const next = setTimeScale(sim, scale);
  if (next === sim) {
    return;
  }
  sim = next;
  pushHud();
};

onMounted(async () => {
  if (!hostRef.value) {
    return;
  }
  app = await createGameApp(hostRef.value, sim.grid, sim.units, (x, y) => {
    const next = simToggleTower(sim, x, y);
    if (next === sim) {
      return;
    }
    sim = next;
    pushHud();
    pushView();
  });

  const loop = (ts: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = lastTs === 0 ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (dt > 0) {
      sim = tick(sim, dt);
      pushHud();
      pushView();
    }
  };
  raf = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
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
      <div class="phase-stack">
        <div
          class="phase-bar"
          :class="hud.phase"
        >
          <span class="phase-name">{{ phaseLabel }}</span>
          <span class="phase-timer">{{ phaseTimeLabel }}</span>
        </div>
        <p class="gold">{{ goldLabel }}</p>
        <p class="base-hp">{{ baseHpLabel }}</p>
        <p
          v-if="!hud.hasPath"
          class="blocked"
        >
          길이 없습니다
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

.phase-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
}

.phase-bar,
.gold,
.base-hp,
.blocked {
  width: fit-content;
  padding: 8px 14px;
  border-radius: 6px;
  background: rgba(20, 12, 10, 0.82);
  font: 700 14px/1.3 "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
}

.phase-bar {
  display: flex;
  align-items: baseline;
  gap: 12px;
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
.base-hp {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.gold {
  color: #e8d48a;
}

.base-hp {
  color: #f0b4a8;
}

.blocked {
  margin: 0;
  color: #f3d7c4;
}

.time-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
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
</style>
