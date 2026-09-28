<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getResearchBuff,
  hasResearchBuff,
  RESEARCH_BUFFS,
  researchPrerequisitesMet,
  researchUnlockRefusal,
  TOWER_TYPE_IDS,
  type ResearchBuffDef,
  type ResearchBuffId,
  type TowerTypeId,
} from "@/core";
import { loadTowerBuildThumbs, towerBuildFallbackThumb } from "@/render/tower-thumbs";

const CARD_W = 104;
const CARD_H = 132;
const GAP_X = 28;
const GAP_Y = 40;
const COLS = 5;
const ROWS = 4;
const TREE_W = COLS * CARD_W + (COLS - 1) * GAP_X;
const TREE_H = ROWS * CARD_H + (ROWS - 1) * GAP_Y;

type Slot = { readonly col: number; readonly row: number };

const TREE_SLOT: Record<ResearchBuffId, Slot> = {
  unlockResearch: { col: 4, row: 1 },
  unlockWall: { col: 2, row: 2 },
  startGold: { col: 4, row: 2 },
  damage: { col: 5, row: 2 },
  unlockMelee: { col: 1, row: 3 },
  unlockCannon: { col: 3, row: 3 },
  allyGold: { col: 4, row: 3 },
  range: { col: 5, row: 3 },
  unlockMage: { col: 2, row: 4 },
};

const BUFF_ICON: Partial<Record<ResearchBuffId, string>> = {
  damage: `<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="#e07050" d="M20 4l3.2 10.2L34 18l-10.8 3.8L20 32l-3.2-10.2L6 18l10.8-3.8z"/><path fill="#f4c8b0" d="M20 12l1.2 3.6L25 17l-3.8 1.4L20 22l-1.2-3.6L15 17l3.8-1.4z"/></svg>`,
  range: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="none" stroke="#88a0e8" stroke-width="2"/><circle cx="20" cy="20" r="2.5" fill="#88a0e8"/><path stroke="#88a0e8" stroke-width="2" stroke-linecap="round" d="M20 3v6M20 31v6M3 20h6M31 20h6"/></svg>`,
  startGold: `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="26" rx="11" ry="4" fill="#8a6230"/><ellipse cx="20" cy="22" rx="11" ry="4" fill="#e8c090"/><ellipse cx="20" cy="18" rx="11" ry="4" fill="#f3deb0"/><ellipse cx="20" cy="15" rx="11" ry="4" fill="#e8c090" stroke="#8a6230" stroke-width="1.4"/></svg>`,
  allyGold: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="16" width="22" height="11" rx="2" fill="#c4a060"/><rect x="11" y="10" width="10" height="8" rx="1" fill="#e8c090"/><circle cx="14" cy="30" r="3" fill="#5a4030"/><circle cx="25" cy="30" r="3" fill="#5a4030"/><path stroke="#f7efe6" stroke-width="1.6" stroke-linecap="round" d="M29 14h6M32 11v6"/></svg>`,
};

const props = defineProps<{
  points: number;
  unlocked: readonly ResearchBuffId[];
}>();

const emit = defineEmits<{
  close: [];
  unlock: [id: ResearchBuffId];
}>();

const error = ref("");
const selectedId = ref<ResearchBuffId | null>(RESEARCH_BUFFS[0]?.id ?? null);
const thumbs = ref<Record<TowerTypeId, string>>(
  Object.fromEntries(TOWER_TYPE_IDS.map((id) => [id, towerBuildFallbackThumb(id)])) as Record<
    TowerTypeId,
    string
  >,
);

onMounted(() => {
  void loadTowerBuildThumbs().then((loaded) => {
    thumbs.value = loaded;
  });
});

const selected = computed(() =>
  selectedId.value ? getResearchBuff(selectedId.value) : null,
);

const owned = (id: ResearchBuffId): boolean => hasResearchBuff(props.unlocked, id);

const parentsReady = (id: ResearchBuffId): boolean =>
  researchPrerequisitesMet(props.unlocked, id);

const canBuy = (id: ResearchBuffId): boolean =>
  researchUnlockRefusal(props.points, props.unlocked, id) === null;

const slotStyle = (id: ResearchBuffId) => {
  const slot = TREE_SLOT[id];
  return { gridColumn: String(slot.col), gridRow: String(slot.row) };
};

const colCenter = (col: number): number => (col - 1) * (CARD_W + GAP_X) + CARD_W / 2;
const rowBottom = (row: number): number => (row - 1) * (CARD_H + GAP_Y) + CARD_H;
const rowTop = (row: number): number => (row - 1) * (CARD_H + GAP_Y);

const elbow = (from: Slot, to: Slot): string => {
  const x1 = colCenter(from.col);
  const y1 = rowBottom(from.row);
  const x2 = colCenter(to.col);
  const y2 = rowTop(to.row);
  if (Math.abs(x1 - x2) < 0.5) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
};

const edges = computed(() => {
  const lines: { id: string; d: string; active: boolean }[] = [];
  for (const buff of RESEARCH_BUFFS) {
    for (const parentId of buff.requires ?? []) {
      lines.push({
        id: `${parentId}-${buff.id}`,
        d: elbow(TREE_SLOT[parentId], TREE_SLOT[buff.id]),
        active: owned(parentId),
      });
    }
  }
  return lines;
});

const parentLabel = (buff: ResearchBuffDef): string => {
  const requires = buff.requires ?? [];
  if (requires.length === 0) {
    return "";
  }
  return requires.map((id) => getResearchBuff(id).name).join(" · ");
};

const statusLabel = (buff: ResearchBuffDef): string => {
  if (owned(buff.id)) {
    return buff.unlocks ? "해금됨" : "적용됨";
  }
  if (!parentsReady(buff.id)) {
    return "선행 필요";
  }
  return `비용 ${buff.cost}`;
};

const iconMarkup = (buff: ResearchBuffDef): string => BUFF_ICON[buff.id] ?? "";

const iconSrc = (buff: ResearchBuffDef): string =>
  buff.unlocks ? thumbs.value[buff.unlocks] : "";

const pointsLabel = computed(() => `연구 포인트 ${Math.floor(props.points)}`);

const onSelect = (id: ResearchBuffId): void => {
  selectedId.value = id;
  error.value = "";
};

const onUnlock = (): void => {
  if (!selectedId.value) {
    return;
  }
  const reason = researchUnlockRefusal(props.points, props.unlocked, selectedId.value);
  if (reason) {
    error.value = reason;
    return;
  }
  error.value = "";
  emit("unlock", selectedId.value);
};
</script>

<template>
  <div
    class="research-overlay"
    @click.self="emit('close')"
  >
    <div
      class="research-panel"
      role="dialog"
      aria-modal="true"
      aria-label="연구 트리"
    >
      <header class="research-head">
        <h2>연구 트리</h2>
        <button
          type="button"
          class="close"
          @click="emit('close')"
        >
          닫기
        </button>
      </header>
      <p class="points">
        {{ pointsLabel }}
      </p>
      <p class="hint">
        위쪽 연구를 마쳐야 아래 연구를 할 수 있습니다. 마법사는 기사와 대포가 모두 필요합니다.
      </p>
      <div class="research-body">
        <div class="buff-list">
          <svg
            class="tree-lines"
            :viewBox="`0 0 ${TREE_W} ${TREE_H}`"
            aria-hidden="true"
          >
            <path
              v-for="edge in edges"
              :key="edge.id"
              :d="edge.d"
              fill="none"
              :stroke="edge.active ? '#70c8c0' : 'rgba(112, 200, 192, 0.4)'"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          <button
            v-for="buff in RESEARCH_BUFFS"
            :key="buff.id"
            type="button"
            class="buff-card"
            :class="{
              on: selectedId === buff.id,
              owned: owned(buff.id),
              blocked: !owned(buff.id) && !parentsReady(buff.id),
            }"
            :style="slotStyle(buff.id)"
            @click="onSelect(buff.id)"
          >
            <span
              class="buff-icon"
              aria-hidden="true"
            >
              <img
                v-if="iconSrc(buff)"
                :src="iconSrc(buff)"
                alt=""
              >
              <span
                v-else
                class="buff-svg"
                v-html="iconMarkup(buff)"
              />
            </span>
            <span class="buff-name">{{ buff.name }}</span>
            <span class="buff-cost">{{ statusLabel(buff) }}</span>
          </button>
        </div>
        <div
          v-if="selected"
          class="buff-detail"
        >
          <span
            class="detail-icon"
            aria-hidden="true"
          >
            <img
              v-if="iconSrc(selected)"
              :src="iconSrc(selected)"
              alt=""
            >
            <span
              v-else
              class="buff-svg"
              v-html="iconMarkup(selected)"
            />
          </span>
          <h3>{{ selected.name }}</h3>
          <p>{{ selected.description }}</p>
          <p
            v-if="parentLabel(selected)"
            class="buff-cost-line"
          >
            선행 {{ parentLabel(selected) }}
          </p>
          <p class="buff-cost-line">
            <template v-if="owned(selected.id) && selected.unlocks">이미 모든 맵에서 지을 수 있습니다.</template>
            <template v-else-if="owned(selected.id)">이미 모든 맵에 적용 중입니다.</template>
            <template v-else>비용 {{ selected.cost }}</template>
          </p>
          <button
            v-if="!owned(selected.id)"
            type="button"
            class="unlock-btn"
            :disabled="!canBuy(selected.id)"
            @click="onUnlock"
          >
            {{ selected.unlocks ? "타워 해금" : "버프 고르기" }}
          </button>
        </div>
      </div>
      <p
        v-if="error"
        class="research-error"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.research-overlay {
  position: fixed;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.55);
  pointer-events: auto;
}

.research-panel {
  width: min(980px, calc(100% - 32px));
  max-height: min(860px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: #1c120e;
  box-shadow: inset 0 0 0 1px rgba(112, 200, 192, 0.4);
  color: #f7efe6;
  font: 700 14px/1.4 "Segoe UI", sans-serif;
}

.research-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.research-head h2 {
  margin: 0;
  font-size: 16px;
}

.close,
.unlock-btn {
  margin: 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(56, 38, 28, 0.95);
  color: #f7efe6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(112, 200, 192, 0.55);
}

.unlock-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.points {
  margin: 0 0 4px;
  color: #88d8d0;
  font-variant-numeric: tabular-nums;
}

.hint {
  margin: 0 0 12px;
  color: #d8cfc6;
  font-weight: 600;
}

.research-body {
  display: grid;
  grid-template-columns: max-content minmax(180px, 1fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
  overflow: auto;
  align-items: start;
}

.buff-list {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 104px);
  grid-template-rows: repeat(4, 132px);
  column-gap: 28px;
  row-gap: 40px;
  width: max-content;
}

.tree-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.buff-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  box-sizing: border-box;
  width: 104px;
  height: 132px;
  margin: 0;
  padding: 8px 6px 8px;
  border: 0;
  border-radius: 8px;
  background: #241612;
  color: #f7efe6;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  text-align: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(112, 200, 192, 0.28);
}

.buff-card.on {
  box-shadow: inset 0 0 0 2px #70c8c0;
}

.buff-card.owned {
  background: #1a2c2a;
}

.buff-card.blocked {
  opacity: 0.72;
}

.buff-icon,
.detail-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 56px;
  height: 64px;
}

.detail-icon {
  width: 72px;
  height: 80px;
}

.buff-icon img,
.detail-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  image-rendering: pixelated;
}

.buff-svg {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
}

.buff-svg :deep(svg) {
  width: 40px;
  height: 40px;
}

.detail-icon .buff-svg,
.detail-icon .buff-svg :deep(svg) {
  width: 56px;
  height: 56px;
}

.buff-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buff-cost {
  color: #b8d8d4;
  font-size: 11px;
}

.buff-detail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 220px;
  padding: 12px 10px;
  border-radius: 8px;
  background: rgba(20, 12, 10, 0.78);
}

.buff-detail h3,
.buff-detail p {
  margin: 0;
}

.buff-detail p {
  color: #d8cfc6;
  font-weight: 600;
}

.buff-cost-line {
  color: #88d8d0 !important;
}

.research-error {
  margin: 10px 0 0;
  color: #e08070;
}
</style>
