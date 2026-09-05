<script setup lang="ts">
import { WORLD_MAPS, type GameMapDef, type MapId } from "@/core";

defineProps<{
  lastMapId: MapId | null;
}>();

const emit = defineEmits<{
  select: [id: MapId];
}>();

const MAP_ACCENTS: Record<MapId, string> = {
  1: "#7cb87c",
  2: "#c4a060",
  3: "#5aa0c8",
  4: "#b87858",
  5: "#6a9a78",
};

type MiniCell = {
  readonly key: string;
  readonly kind: "empty" | "start" | "base";
};

const miniCells = (map: GameMapDef): MiniCell[] => {
  const cells: MiniCell[] = [];
  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.cols; x += 1) {
      let kind: MiniCell["kind"] = "empty";
      if (x === map.start.x && y === map.start.y) {
        kind = "start";
      } else if (x === map.base.x && y === map.base.y) {
        kind = "base";
      }
      cells.push({ key: `${x},${y}`, kind });
    }
  }
  return cells;
};
</script>

<template>
  <div class="world-map">
    <header class="world-head">
      <h1>월드맵</h1>
      <p>서로 다른 게임 맵 5개 중 하나를 고르면 그 맵의 배틀로 들어갑니다.</p>
    </header>
    <ol class="map-row">
      <li
        v-for="map in WORLD_MAPS"
        :key="map.id"
      >
        <button
          type="button"
          class="map-card"
          :class="{ last: lastMapId === map.id }"
          :style="{ '--accent': MAP_ACCENTS[map.id] }"
          :aria-label="`${map.name} 맵으로 배틀 시작`"
          @click="emit('select', map.id)"
        >
          <span class="map-index">맵 {{ map.id }}</span>
          <span class="map-name">{{ map.name }}</span>
          <span
            class="mini-grid"
            :style="{
              gridTemplateColumns: `repeat(${map.cols}, 1fr)`,
              aspectRatio: `${map.cols} / ${map.rows}`,
            }"
          >
            <span
              v-for="cell in miniCells(map)"
              :key="cell.key"
              class="mini-cell"
              :class="cell.kind"
            />
          </span>
          <span class="map-meta">{{ map.cols }}×{{ map.rows }}</span>
          <span class="map-meta">Start {{ map.start.x }},{{ map.start.y }} · Base {{ map.base.x }},{{ map.base.y }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.world-map {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  height: 100%;
  padding: 28px 24px 32px;
  overflow: auto;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(124, 184, 124, 0.12), transparent 42%),
    radial-gradient(ellipse at 80% 80%, rgba(90, 160, 200, 0.1), transparent 46%),
    #141210;
  color: #f7efe6;
}

.world-head {
  text-align: center;
}

.world-head h1 {
  margin: 0 0 8px;
  font: 700 28px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.06em;
}

.world-head p {
  margin: 0;
  color: #d8cfc6;
  font: 600 14px/1.4 "Segoe UI", sans-serif;
}

.map-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.map-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(210px, 100%);
  margin: 0;
  padding: 14px 12px 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.92);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.map-card.last {
  background: rgba(56, 38, 28, 0.96);
  box-shadow:
    inset 0 0 0 2px var(--accent),
    0 0 0 2px rgba(232, 176, 96, 0.55);
}

.map-card:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 3px;
}

.map-index {
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.map-name {
  font: 700 20px/1.2 "Segoe UI", sans-serif;
}

.mini-grid {
  display: grid;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
  background: #1a2218;
  box-shadow: inset 0 0 0 1px rgba(22, 28, 22, 0.8);
}

.mini-cell {
  min-height: 4px;
  background: #2a3424;
  box-shadow: inset 0 0 0 1px #161c16;
}

.mini-cell.start {
  background: #2f6fb3;
}

.mini-cell.base {
  background: #b45a28;
}

.map-meta {
  color: #d8cfc6;
  font: 600 12px/1.35 "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}
</style>
