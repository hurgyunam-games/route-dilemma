<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import { createSim, findPath, simToggleTower, tick } from "@/core";
import {
  createGameApp,
  destroyGameApp,
  setGameView,
} from "@/render/create-game-app";

const hostRef = ref<HTMLElement | null>(null);
let sim = createSim();
const hasPath = ref(findPath(sim.grid) !== null);
let app: Application | null = null;
let raf = 0;
let lastTs = 0;

const pushView = (): void => {
  if (app) {
    setGameView(app, sim.grid, sim.units);
  }
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
    hasPath.value = findPath(sim.grid) !== null;
    pushView();
  });

  const loop = (ts: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = lastTs === 0 ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (dt > 0) {
      sim = tick(sim, dt);
      hasPath.value = findPath(sim.grid) !== null;
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
      <p
        v-if="!hasPath"
        class="blocked"
      >
        길이 없습니다
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

.blocked {
  margin: 16px auto 0;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 6px;
  background: rgba(20, 12, 10, 0.82);
  color: #f3d7c4;
  font: 700 14px/1.3 "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
}
</style>
