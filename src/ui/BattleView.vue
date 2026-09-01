<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import { createGrid, findPath, toggleTower } from "@/core";
import {
  createGameApp,
  destroyGameApp,
  setGameGrid,
} from "@/render/create-game-app";

const hostRef = ref<HTMLElement | null>(null);
let grid = createGrid();
const hasPath = ref(findPath(grid) !== null);
let app: Application | null = null;

const applyGrid = (next: typeof grid): void => {
  grid = next;
  hasPath.value = findPath(grid) !== null;
  if (app) {
    setGameGrid(app, grid);
  }
};

onMounted(async () => {
  if (!hostRef.value) {
    return;
  }
  app = await createGameApp(hostRef.value, grid, (x, y) => {
    if (!app) {
      return;
    }
    const next = toggleTower(grid, x, y);
    if (next === grid) {
      return;
    }
    applyGrid(next);
  });
});

onUnmounted(() => {
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
