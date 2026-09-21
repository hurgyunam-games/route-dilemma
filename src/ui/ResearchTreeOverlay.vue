<script setup lang="ts">
import { computed, ref } from "vue";
import {
  getResearchBuff,
  hasResearchBuff,
  RESEARCH_BUFFS,
  type ResearchBuffId,
} from "@/core";

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

const selected = computed(() =>
  selectedId.value ? getResearchBuff(selectedId.value) : null,
);

const owned = (id: ResearchBuffId): boolean => hasResearchBuff(props.unlocked, id);

const canBuy = (id: ResearchBuffId): boolean =>
  !owned(id) && props.points >= getResearchBuff(id).cost;

const pointsLabel = computed(() => `연구 포인트 ${Math.floor(props.points)}`);

const onSelect = (id: ResearchBuffId): void => {
  selectedId.value = id;
  error.value = "";
};

const onUnlock = (): void => {
  if (!selectedId.value) {
    return;
  }
  if (owned(selectedId.value)) {
    error.value = "이미 고른 버프입니다";
    return;
  }
  if (!canBuy(selectedId.value)) {
    const cost = getResearchBuff(selectedId.value).cost;
    error.value = `연구 포인트가 부족합니다 (필요 ${cost}, 보유 ${Math.floor(props.points)})`;
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
        고른 버프는 모든 맵에 공통으로 적용됩니다.
      </p>
      <div class="research-body">
        <div class="buff-list">
          <button
            v-for="buff in RESEARCH_BUFFS"
            :key="buff.id"
            type="button"
            class="buff-card"
            :class="{ on: selectedId === buff.id, owned: owned(buff.id) }"
            @click="onSelect(buff.id)"
          >
            <span class="buff-name">{{ buff.name }}</span>
            <span class="buff-cost">
              <template v-if="owned(buff.id)">적용됨</template>
              <template v-else>비용 {{ buff.cost }}</template>
            </span>
          </button>
        </div>
        <div
          v-if="selected"
          class="buff-detail"
        >
          <h3>{{ selected.name }}</h3>
          <p>{{ selected.description }}</p>
          <p class="buff-cost-line">
            <template v-if="owned(selected.id)">이미 모든 맵에 적용 중입니다.</template>
            <template v-else>비용 {{ selected.cost }}</template>
          </p>
          <button
            v-if="!owned(selected.id)"
            type="button"
            class="unlock-btn"
            :disabled="!canBuy(selected.id)"
            @click="onUnlock"
          >
            버프 고르기
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
  width: min(640px, calc(100% - 32px));
  max-height: min(520px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
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
  grid-template-columns: minmax(0, 1.1fr) minmax(180px, 0.9fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.buff-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.buff-card {
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
  box-shadow: inset 0 0 0 1px rgba(112, 200, 192, 0.28);
}

.buff-card.on {
  box-shadow: inset 0 0 0 2px #70c8c0;
}

.buff-card.owned {
  background: rgba(24, 42, 40, 0.95);
}

.buff-cost {
  color: #b8d8d4;
  font-size: 12px;
}

.buff-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 180px;
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
