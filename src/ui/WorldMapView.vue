<script setup lang="ts">
import {
  campaignCycle,
  campaignMapStatuses,
  currentStage,
  type CampaignProgress,
  type GameMapDef,
  type MapId,
  type ObstacleKind,
} from "@/core";
import { computed } from "vue";

const props = defineProps<{
  lastMapId: MapId | null;
  progress: CampaignProgress;
}>();

const emit = defineEmits<{
  select: [id: MapId];
  gallery: [];
  waves: [];
  enemies: [];
}>();

const MAP_ACCENTS: Record<MapId, string> = {
  1: "#7cb87c",
  2: "#c4a060",
  3: "#5aa0c8",
  4: "#b87858",
  5: "#6a9a78",
};

const statuses = computed(() => campaignMapStatuses(props.progress));
const stageNow = computed(() => currentStage(props.progress));
const loopHint = computed(() =>
  campaignCycle(stageNow.value) > 0
    ? "돌아온 판은 적이 더 셉니다. 기존 타워만으로는 버티기 어려우니 보강하세요."
    : "",
);

type MiniCell = {
  readonly key: string;
  readonly kind: "empty" | "start" | "base" | "tower" | ObstacleKind;
};

const miniCells = (map: GameMapDef, towers: readonly { x: number; y: number }[]): MiniCell[] => {
  const cells: MiniCell[] = [];
  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.cols; x += 1) {
      let kind: MiniCell["kind"] = "empty";
      if (x === map.start.x && y === map.start.y) {
        kind = "start";
      } else if (x === map.base.x && y === map.base.y) {
        kind = "base";
      } else if (towers.some((tower) => tower.x === x && tower.y === y)) {
        kind = "tower";
      } else {
        const obstacle = map.obstacles.find((entry) => entry.x === x && entry.y === y);
        if (obstacle) {
          kind = obstacle.kind;
        }
      }
      cells.push({ key: `${x},${y}`, kind });
    }
  }
  return cells;
};

const onSelect = (id: MapId, unlocked: boolean): void => {
  if (!unlocked) {
    return;
  }
  emit("select", id);
};
</script>

<template>
  <div class="world-map">
    <header class="world-head">
      <h1>월드맵</h1>
      <p class="stage-now">
        현재 스테이지 {{ stageNow }}
      </p>
      <p>
        스테이지 1–5는 맵 1–5와 하나씩 대응합니다. 스테이지 6부터는 맵 1로 돌아오며, 그 맵에 지은 타워가 남아 있습니다.
      </p>
      <div class="tool-links">
        <button
          type="button"
          class="gallery-link"
          @click="emit('gallery')"
        >
          스프라이트 갤러리
        </button>
        <button
          type="button"
          class="gallery-link"
          @click="emit('waves')"
        >
          웨이브 에디터
        </button>
        <button
          type="button"
          class="gallery-link"
          @click="emit('enemies')"
        >
          적 에디터
        </button>
      </div>
      <p
        v-if="loopHint"
        class="loop-hint"
      >
        {{ loopHint }}
      </p>
    </header>
    <ol class="map-row">
      <li
        v-for="status in statuses"
        :key="status.mapId"
      >
        <button
          type="button"
          class="map-card"
          :class="{
            last: lastMapId === status.mapId,
            locked: !status.unlocked,
            cleared: status.cleared,
            current: status.current,
          }"
          :style="{ '--accent': MAP_ACCENTS[status.mapId] }"
          :disabled="!status.unlocked"
          :aria-label="
            status.unlocked
              ? `스테이지 ${status.stageId} ${status.map.name} 맵으로 배틀 시작${status.cleared ? ', 클리어' : ''}`
              : `스테이지 ${status.stageId} ${status.map.name} 잠김`
          "
          @click="onSelect(status.mapId, status.unlocked)"
        >
          <span class="map-index">스테이지 {{ status.stageId }}</span>
          <span class="map-name">{{ status.map.name }}</span>
          <span
            class="mini-grid"
            :style="{
              gridTemplateColumns: `repeat(${status.map.cols}, 1fr)`,
              aspectRatio: `${status.map.cols} / ${status.map.rows}`,
            }"
          >
            <span
              v-for="cell in miniCells(status.map, status.towers)"
              :key="cell.key"
              class="mini-cell"
              :class="cell.kind"
            />
          </span>
          <span class="map-meta">맵 {{ status.mapId }} · {{ status.map.cols }}×{{ status.map.rows }}</span>
          <span class="map-state">
            <template v-if="!status.unlocked">잠김</template>
            <template v-else-if="status.current">플레이</template>
            <template v-else-if="status.cleared">클리어</template>
            <template v-else>플레이</template>
          </span>
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

.world-head .stage-now {
  margin: 0 0 8px;
  color: #e8b060;
  font: 700 18px/1.3 "Segoe UI", sans-serif;
}

.world-head .loop-hint {
  margin: 8px 0 0;
  color: #e8b060;
}

.tool-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 14px 0 0;
}

.gallery-link {
  display: inline-block;
  margin: 0;
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: #3a3228;
  color: #f7efe6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.45);
}

.gallery-link:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 3px;
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

.map-card.current:not(.last) {
  box-shadow:
    inset 0 0 0 2px var(--accent),
    0 0 0 2px rgba(232, 176, 96, 0.35);
}

.map-card.cleared:not(.locked) {
  background: rgba(32, 42, 28, 0.94);
}

.map-card.locked {
  cursor: not-allowed;
  filter: grayscale(0.7);
  opacity: 0.55;
  box-shadow: inset 0 0 0 2px #5a534c;
}

.map-card:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 3px;
}

.map-card.locked:focus-visible {
  outline-color: #8a8478;
}

.map-index {
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.map-card.locked .map-index {
  color: #8a8478;
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

.mini-cell.rock {
  background: #8a8478;
}

.mini-cell.tree {
  background: #3d7a3a;
}

.mini-cell.tower {
  background: #d4a574;
}

.map-meta {
  color: #d8cfc6;
  font: 600 12px/1.35 "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}

.map-state {
  font: 700 13px/1.3 "Segoe UI", sans-serif;
  letter-spacing: 0.04em;
}

.map-card.locked .map-state {
  color: #b8b0a8;
}

.map-card.cleared:not(.locked) .map-state {
  color: #8fd08a;
}

.map-card.current .map-state {
  color: #e8b060;
}
</style>
