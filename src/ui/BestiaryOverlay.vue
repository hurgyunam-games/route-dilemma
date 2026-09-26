<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type CSSProperties } from "vue";
import {
  BESTIARY_LOCKED_NAME,
  bestiaryEntries,
  normalizeHue,
  type EnemyTypeId,
} from "@/core";
import { enemyWalkPreview, loadEnemyWalkThumbs } from "@/render/enemy-sprites";

const props = defineProps<{
  unlockedIds: readonly string[];
  newIds?: readonly string[];
  focusId?: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const selectedId = ref<string | null>(props.focusId ?? null);
const listRef = ref<HTMLElement | null>(null);
const walkThumbs = ref<Partial<Record<EnemyTypeId, string>>>({});

onMounted(() => {
  void loadEnemyWalkThumbs().then((thumbs) => {
    walkThumbs.value = thumbs;
  });
  void scrollFocusedIntoView();
});

const entries = computed(() => bestiaryEntries(props.unlockedIds, props.newIds ?? []));
const selected = computed(
  () => entries.value.find((entry) => entry.id === selectedId.value) ?? null,
);

watch(
  () => props.focusId,
  (id) => {
    if (id) {
      selectedId.value = id;
      void scrollFocusedIntoView();
    }
  },
);

const hueFilter = (hue: number): string => {
  const deg = normalizeHue(hue);
  return deg === 0 ? "none" : `hue-rotate(${deg}deg)`;
};

const spriteArtStyle = (sprite: EnemyTypeId, hue = 0, silhouette = false): CSSProperties => {
  const preview = enemyWalkPreview(sprite);
  const filter = silhouette ? "brightness(0)" : hueFilter(hue);
  const thumb = walkThumbs.value[sprite];
  if (thumb) {
    return {
      backgroundImage: `url(${thumb})`,
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      filter,
    };
  }
  if (preview.url) {
    return {
      backgroundImage: `url(${preview.url})`,
      backgroundSize: `${preview.cols * 100}% 100%`,
      backgroundPosition: "0 0",
      backgroundRepeat: "no-repeat",
      filter,
    };
  }
  return {
    backgroundColor: silhouette ? "#1a1412" : preview.fallback,
    filter: "none",
  };
};

const hasWalkSheet = (sprite: EnemyTypeId): boolean =>
  !walkThumbs.value[sprite] && Boolean(enemyWalkPreview(sprite).url);

const entryLabel = (entry: { unlocked: boolean; isNew: boolean; name: string }): string => {
  if (!entry.unlocked) {
    return "아직 열리지 않은 적";
  }
  return entry.isNew ? `${entry.name} NEW` : entry.name;
};

const onSelect = (id: string): void => {
  selectedId.value = id;
};

const scrollFocusedIntoView = async (): Promise<void> => {
  const id = selectedId.value;
  if (!id) {
    return;
  }
  await nextTick();
  const target = listRef.value?.querySelector<HTMLElement>(`[data-enemy-id="${id}"]`);
  target?.scrollIntoView({ block: "nearest" });
};
</script>

<template>
  <div
    class="bestiary-overlay"
    @click.self="emit('close')"
  >
    <div
      class="bestiary-panel"
      role="dialog"
      aria-modal="true"
      aria-label="도감"
    >
      <header class="bestiary-head">
        <h2>도감</h2>
        <button
          type="button"
          class="close"
          @click="emit('close')"
        >
          닫기
        </button>
      </header>
      <div class="bestiary-body">
        <div
          ref="listRef"
          class="bestiary-list"
        >
          <button
            v-for="entry in entries"
            :key="entry.id"
            type="button"
            class="entry"
            :class="{ on: selectedId === entry.id, locked: !entry.unlocked }"
            :data-enemy-id="entry.id"
            :aria-label="entryLabel(entry)"
            @click="onSelect(entry.id)"
          >
            <span
              class="thumb"
              :class="{ locked: !entry.unlocked }"
            >
              <span
                class="art"
                :class="{ sheet: hasWalkSheet(entry.sprite) }"
                :style="spriteArtStyle(entry.sprite, entry.hue, !entry.unlocked)"
                aria-hidden="true"
              />
              <span
                v-if="entry.isNew"
                class="badge"
              >NEW</span>
            </span>
            <span class="entry-name">{{ entry.name }}</span>
          </button>
        </div>
        <aside class="bestiary-detail">
          <template v-if="selected?.unlocked">
            <span class="portrait">
              <span
                class="art"
                :class="{ sheet: hasWalkSheet(selected.sprite) }"
                :style="spriteArtStyle(selected.sprite, selected.hue, false)"
                aria-hidden="true"
              />
              <span
                v-if="selected.isNew"
                class="badge"
              >NEW</span>
            </span>
            <h3>{{ selected.name }}</h3>
            <p>행동 {{ selected.behaviorLabel }}</p>
            <p
              v-if="selected.story"
              class="story"
            >
              {{ selected.story }}
            </p>
          </template>
          <template v-else-if="selected">
            <span
              class="portrait"
              :class="{ locked: true }"
            >
              <span
                class="art"
                :class="{ sheet: hasWalkSheet(selected.sprite) }"
                :style="spriteArtStyle(selected.sprite, 0, true)"
                aria-hidden="true"
              />
            </span>
            <h3>{{ BESTIARY_LOCKED_NAME }}</h3>
            <p>아직 모습이 밝혀지지 않았습니다.</p>
          </template>
          <p
            v-else
            class="hint"
          >
            적을 고르면 알려진 특징이 나옵니다.
          </p>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bestiary-overlay {
  position: fixed;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.55);
  pointer-events: auto;
}

.bestiary-panel {
  width: min(720px, calc(100% - 32px));
  max-height: min(560px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.35);
  color: #f7efe6;
  font: 700 14px/1.4 "Segoe UI", sans-serif;
}

.bestiary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.bestiary-head h2 {
  margin: 0;
  font-size: 16px;
}

.close {
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

.bestiary-body {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(180px, 0.9fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.bestiary-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 6px;
  border: 0;
  border-radius: 8px;
  background: rgba(20, 12, 10, 0.9);
  color: #f7efe6;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.22);
}

.entry.on {
  box-shadow: inset 0 0 0 2px #e8b060;
}

.entry-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb,
.portrait {
  position: relative;
  display: block;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
  background-color: #1a1412;
}

.thumb.locked,
.portrait.locked {
  background-color: #c8c0b4;
}

.art {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  background-repeat: no-repeat;
}

.thumb {
  width: 48px;
  height: 48px;
}

.art.sheet {
  background-size: 600% 100%;
  background-position: 0 0;
}

.badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  padding: 1px 4px;
  border-radius: 0 4px 0 4px;
  background: #e8b060;
  color: #2a1810;
  font-size: 9px;
  letter-spacing: 0.04em;
}

.bestiary-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 220px;
  padding: 12px 10px;
  border-radius: 8px;
  background: rgba(20, 12, 10, 0.78);
  text-align: center;
}

.bestiary-detail h3,
.bestiary-detail p {
  margin: 0;
}

.bestiary-detail p {
  color: #d8cfc6;
  font-weight: 600;
}

.story {
  max-width: 28em;
  font-weight: 500;
  line-height: 1.5;
  color: #f0e6d8;
}

.hint {
  margin: auto 0 !important;
  color: #b8aea4 !important;
}

.portrait {
  width: 96px;
  height: 96px;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.28);
}
</style>
