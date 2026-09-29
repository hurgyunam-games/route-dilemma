<script setup lang="ts">
import { currentStage, type CampaignLoadStatus, type SaveSlot } from "@/core";
import { computed, ref } from "vue";

const props = defineProps<{
  slots: readonly SaveSlot[];
  listStatus: CampaignLoadStatus;
}>();

const emit = defineEmits<{
  create: [];
  open: [id: string];
  remove: [id: string];
}>();

const pendingDeleteId = ref<string | null>(null);
const listLocked = computed(() => props.listStatus === "newer");

const canOpen = (slot: SaveSlot): boolean =>
  !listLocked.value && slot.status !== "newer" && slot.status !== "invalid";

const summary = (slot: SaveSlot): string => {
  if (slot.status === "newer") {
    return "더 새 게임 버전에서 만든 세이브입니다.";
  }
  if (slot.status === "invalid") {
    return "이 세이브를 읽을 수 없습니다.";
  }
  return `현재 스테이지 ${currentStage(slot.progress)}`;
};

const savedAt = (ms: number): string => {
  if (!(ms > 0)) {
    return "";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
};

const onOpen = (slot: SaveSlot): void => {
  if (!canOpen(slot)) {
    return;
  }
  pendingDeleteId.value = null;
  emit("open", slot.id);
};

const onDelete = (id: string): void => {
  if (listLocked.value) {
    return;
  }
  if (pendingDeleteId.value !== id) {
    pendingDeleteId.value = id;
    return;
  }
  pendingDeleteId.value = null;
  emit("remove", id);
};
</script>

<template>
  <div class="save-list">
    <header class="save-head">
      <h1>세이브</h1>
      <p>진행을 여러 개 저장하고, 하나를 골라 이어합니다.</p>
      <button
        type="button"
        class="new-game"
        :disabled="listLocked"
        @click="emit('create')"
      >
        새 게임
      </button>
      <p
        v-if="listLocked"
        class="save-notice"
      >
        이 세이브 목록은 더 새 게임 버전에서 만들어졌습니다. 진행을 덮어쓰지 않습니다.
      </p>
      <p
        v-else-if="listStatus === 'invalid'"
        class="save-notice"
      >
        세이브를 읽지 못해 빈 목록으로 시작합니다.
      </p>
    </header>
    <p
      v-if="slots.length === 0"
      class="empty"
    >
      저장된 게임이 없습니다.
    </p>
    <ol
      v-else
      class="slot-list"
    >
      <li
        v-for="slot in slots"
        :key="slot.id"
        class="slot-row"
      >
        <button
          type="button"
          class="slot-card"
          :disabled="!canOpen(slot)"
          :aria-label="`${slot.name}, ${summary(slot)}`"
          @click="onOpen(slot)"
        >
          <span class="slot-name">{{ slot.name }}</span>
          <span class="slot-meta">{{ summary(slot) }}</span>
          <span
            v-if="savedAt(slot.updatedAt)"
            class="slot-meta"
          >{{ savedAt(slot.updatedAt) }}</span>
        </button>
        <button
          type="button"
          class="delete-save"
          :disabled="listLocked"
          @click="onDelete(slot.id)"
        >
          {{ pendingDeleteId === slot.id ? "확인" : "삭제" }}
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.save-list {
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

.save-head {
  text-align: center;
}

.save-head h1 {
  margin: 0 0 8px;
  font: 700 28px/1.2 "Segoe UI", sans-serif;
  letter-spacing: 0.06em;
}

.save-head p,
.empty {
  margin: 0;
  color: #d8cfc6;
  font: 600 14px/1.4 "Segoe UI", sans-serif;
}

.new-game,
.delete-save {
  border: 0;
  border-radius: 6px;
  background: #3a3228;
  color: #f7efe6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.45);
}

.new-game {
  margin-top: 14px;
  padding: 10px 18px;
}

.delete-save {
  flex: 0 0 auto;
  padding: 8px 12px;
}

.new-game:disabled,
.delete-save:disabled,
.slot-card:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.new-game:focus-visible,
.delete-save:focus-visible,
.slot-card:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 3px;
}

.save-notice {
  margin: 8px 0 0 !important;
  color: #e08070 !important;
}

.empty {
  text-align: center;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(520px, 100%);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}

.slot-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.slot-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 14px 16px;
  border: 0;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.92);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: inset 0 0 0 2px #c4a060;
}

.slot-name {
  font: 700 18px/1.2 "Segoe UI", sans-serif;
}

.slot-meta {
  color: #d8cfc6;
  font: 600 13px/1.35 "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}
</style>
