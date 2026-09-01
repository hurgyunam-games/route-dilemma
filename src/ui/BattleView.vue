<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import { createGameApp, destroyGameApp } from "@/render/create-game-app";

const hostRef = ref<HTMLElement | null>(null);
let app: Application | null = null;

onMounted(async () => {
  if (!hostRef.value) {
    return;
  }
  app = await createGameApp(hostRef.value);
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
    <div class="hud" />
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
</style>
