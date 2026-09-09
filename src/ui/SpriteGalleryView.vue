<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { Application } from "pixi.js";
import {
  createGalleryApp,
  destroyGalleryApp,
  setGalleryState,
} from "@/render/create-gallery-app";
import {
  GALLERY_GROUP_LABELS,
  GALLERY_GROUPS,
  GALLERY_ITEMS,
  galleryItemsFor,
  knobsForItem,
  type GalleryGroup,
  type LayoutKnob,
} from "@/render/gallery-catalog";
import {
  formatSpriteLayoutSource,
  resetSpriteLayout,
  roundLayoutValue,
} from "@/render/sprite-layout";

const emit = defineEmits<{
  leave: [];
}>();

const hostRef = ref<HTMLElement | null>(null);
const selectedId = ref<string | null>(null);
const group = ref<GalleryGroup | "all">("all");
const layoutRev = ref(0);
const copyHint = ref("");
let app: Application | null = null;

const pushState = (): void => {
  if (app) {
    setGalleryState(app, {
      selectedId: selectedId.value,
      group: group.value,
      layoutRev: layoutRev.value,
    });
  }
};

const selectedItem = computed(() =>
  GALLERY_ITEMS.find((item) => item.id === selectedId.value) ?? null,
);

const knobs = computed(() => {
  void layoutRev.value;
  return selectedItem.value ? knobsForItem(selectedItem.value) : [];
});

const sourceText = computed(() => {
  void layoutRev.value;
  return formatSpriteLayoutSource();
});

const visibleCount = computed(() => galleryItemsFor(group.value).length);

const applyKnob = (knob: LayoutKnob, value: number): void => {
  knob.set(value);
  layoutRev.value += 1;
  pushState();
};

const nudgeKnob = (knob: LayoutKnob, screenDelta: number): void => {
  applyKnob(knob, knob.get() + screenDelta * knob.screenSign);
};

const setKnobFromEvent = (knob: LayoutKnob, event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  applyKnob(knob, Number(target.value) || 0);
};

const onSelect = (id: string | null): void => {
  selectedId.value = id;
  pushState();
};

const onGroup = (next: GalleryGroup | "all"): void => {
  group.value = next;
  selectedId.value = null;
  pushState();
};

const resetAll = (): void => {
  resetSpriteLayout();
  layoutRev.value += 1;
  pushState();
};

const copySource = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(sourceText.value);
    copyHint.value = "복사됨";
  } catch {
    copyHint.value = "복사 실패";
  }
  window.setTimeout(() => {
    copyHint.value = "";
  }, 1200);
};

const onKey = (event: KeyboardEvent): void => {
  if (knobs.value.length === 0) {
    return;
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  const step = event.shiftKey ? 0.05 : 0.01;
  const yKnob = knobs.value.find((entry) => entry.axis === "y");
  const xKnob = knobs.value.find((entry) => entry.axis === "x");
  if (event.key === "ArrowLeft" && xKnob) {
    event.preventDefault();
    nudgeKnob(xKnob, -step);
  } else if (event.key === "ArrowRight" && xKnob) {
    event.preventDefault();
    nudgeKnob(xKnob, step);
  } else if (event.key === "ArrowUp" && yKnob) {
    event.preventDefault();
    nudgeKnob(yKnob, step);
  } else if (event.key === "ArrowDown" && yKnob) {
    event.preventDefault();
    nudgeKnob(yKnob, -step);
  }
};

onMounted(async () => {
  if (!hostRef.value) {
    return;
  }
  window.addEventListener("keydown", onKey);
  app = await createGalleryApp(hostRef.value, onSelect, () => {});
  pushState();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  resetSpriteLayout();
  if (app) {
    destroyGalleryApp(app);
    app = null;
  }
});
</script>

<template>
  <div class="gallery">
    <div
      ref="hostRef"
      class="canvas-host"
    />
    <aside class="panel">
      <header class="panel-head">
        <button
          type="button"
          class="back"
          @click="emit('leave')"
        >
          월드맵
        </button>
        <h1>스프라이트 갤러리</h1>
        <p>
          칸을 고르면 <code>spriteLayout</code> 필드가 나옵니다. 숫자를 맞춘 뒤 아래 코드를
          <code>src/render/sprite-layout.ts</code>에 붙여 넣으세요.
        </p>
      </header>
      <div class="filters">
        <button
          type="button"
          :class="{ on: group === 'all' }"
          @click="onGroup('all')"
        >
          전체 {{ GALLERY_ITEMS.length }}
        </button>
        <button
          v-for="id in GALLERY_GROUPS"
          :key="id"
          type="button"
          :class="{ on: group === id }"
          @click="onGroup(id)"
        >
          {{ GALLERY_GROUP_LABELS[id] }}
        </button>
      </div>
      <p class="count">
        {{ visibleCount }}개 표시
      </p>
      <section
        v-if="selectedItem"
        class="selected"
      >
        <h2>{{ selectedItem.label }}</h2>
        <template v-if="knobs.length > 0">
          <p class="hint">
            방향키 0.01 · Shift 0.05
          </p>
          <div
            v-for="knob in knobs"
            :key="knob.id"
            class="knob"
          >
            <label>
              {{ knob.label }}
              <code>{{ knob.source }}</code>
              <input
                type="number"
                step="0.01"
                :value="roundLayoutValue(knob.get())"
                @change="setKnobFromEvent(knob, $event)"
              >
              <button
                type="button"
                @click="applyKnob(knob, knob.get() - 0.01)"
              >
                −
              </button>
              <button
                type="button"
                @click="applyKnob(knob, knob.get() + 0.01)"
              >
                +
              </button>
            </label>
            <p class="hint">
              {{ knob.hint }}
            </p>
          </div>
        </template>
      </section>
      <p
        v-else
        class="hint"
      >
        칸을 클릭해 오브젝트를 고르세요.
      </p>
      <div class="json-actions">
        <button
          type="button"
          @click="copySource"
        >
          소스 복사
        </button>
        <button
          type="button"
          class="ghost"
          @click="resetAll"
        >
          기본값
        </button>
        <span
          v-if="copyHint"
          class="copied"
        >{{ copyHint }}</span>
      </div>
      <textarea
        class="json"
        readonly
        :value="sourceText"
        spellcheck="false"
      />
    </aside>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  width: 100%;
  height: 100%;
  background: #141210;
  color: #f7efe6;
}

.canvas-host {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(340px, 40vw);
  height: 100%;
  padding: 14px 14px 12px;
  overflow: auto;
  background: rgba(20, 16, 14, 0.96);
  box-shadow: inset 1px 0 0 rgba(232, 176, 96, 0.2);
}

.panel-head h1 {
  margin: 8px 0 6px;
  font: 700 20px/1.2 "Segoe UI", sans-serif;
}

.panel-head p,
.hint,
.count {
  margin: 0;
  color: #d8cfc6;
  font: 600 13px/1.4 "Segoe UI", sans-serif;
}

code {
  font: 600 11px/1.3 ui-monospace, monospace;
  color: #e8b060;
}

.back,
.filters button,
.knob button,
.json-actions button,
.ghost {
  border: 0;
  border-radius: 6px;
  background: #3a3228;
  color: inherit;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
}

.back {
  padding: 7px 10px;
  background: #e8b060;
  color: #1a1410;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filters button {
  padding: 6px 8px;
}

.filters button.on {
  background: #e8b060;
  color: #1a1410;
}

.selected h2 {
  margin: 0 0 4px;
  font: 700 16px/1.2 "Segoe UI", sans-serif;
}

.knob {
  margin: 10px 0;
}

.knob label {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto auto auto;
  gap: 4px 6px;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
}

.knob label code {
  grid-column: 1 / -1;
}

.knob input {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: #1a1412;
  color: #f7efe6;
  font: 700 14px/1 "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}

.knob button {
  width: 28px;
  height: 28px;
  align-self: end;
}

.json-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.json-actions button {
  padding: 7px 10px;
}

.copied {
  color: #8fd08a;
  font: 700 12px/1 "Segoe UI", sans-serif;
}

.json {
  box-sizing: border-box;
  flex: 1;
  min-height: 140px;
  width: 100%;
  margin: 0;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: #1a1412;
  color: #d8cfc6;
  font: 600 11px/1.35 ui-monospace, monospace;
  resize: vertical;
}
</style>
