<script setup lang="ts">
import { onMounted, ref, type CSSProperties } from "vue";
import {
  normalizeHue,
  type EnemyTypeId,
  type WavePreviewEntry,
} from "@/core";
import { enemyWalkPreview, loadEnemyWalkThumbs } from "@/render/enemy-sprites";
import { content, t, warningMessage, warningTitle } from "@/ui/i18n";

defineProps<{
  roster: readonly WavePreviewEntry[];
}>();

const emit = defineEmits<{
  select: [enemyId: string];
  confirm: [];
}>();

const walkThumbs = ref<Partial<Record<EnemyTypeId, string>>>({});

onMounted(() => {
  void loadEnemyWalkThumbs().then((thumbs) => {
    walkThumbs.value = thumbs;
  });
});

const hueFilter = (hue: number): string => {
  const deg = normalizeHue(hue);
  return deg === 0 ? "none" : `hue-rotate(${deg}deg)`;
};

const spriteArtStyle = (sprite: EnemyTypeId, hue = 0): CSSProperties => {
  const preview = enemyWalkPreview(sprite);
  const thumb = walkThumbs.value[sprite];
  if (thumb) {
    return {
      backgroundImage: `url(${thumb})`,
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      filter: hueFilter(hue),
    };
  }
  if (preview.url) {
    return {
      backgroundImage: `url(${preview.url})`,
      backgroundSize: `${preview.cols * 100}% 100%`,
      backgroundPosition: "0 0",
      backgroundRepeat: "no-repeat",
      filter: hueFilter(hue),
    };
  }
  return {
    backgroundColor: preview.fallback,
    filter: "none",
  };
};

const hasWalkSheet = (sprite: EnemyTypeId): boolean =>
  !walkThumbs.value[sprite] && Boolean(enemyWalkPreview(sprite).url);

const shownName = (entry: WavePreviewEntry): string =>
  content(`enemy.${entry.id}.name`, entry.name);

const entryLabel = (entry: WavePreviewEntry): string => {
  const name = entry.isNew
    ? t("bestiary.namedNew", { name: shownName(entry) })
    : shownName(entry);
  const title = warningTitle(entry.behavior);
  const message = warningMessage(entry.behavior);
  if (!title || !message) {
    return name;
  }
  return t("wave.entry", { name, title, message });
};
</script>

<template>
  <div
    class="wave-preview"
    role="status"
    aria-live="polite"
    :aria-label="t('wave.aria')"
  >
    <p class="title">{{ t("wave.title") }}</p>
    <ul class="roster">
      <li
        v-for="entry in roster"
        :key="entry.id"
      >
        <button
          type="button"
          class="entry"
          :class="{
            fresh: entry.isNew,
            breaker: entry.behavior === 'breaker',
            ambush: entry.behavior === 'ambush',
          }"
          :aria-label="entryLabel(entry)"
          @click="emit('select', entry.id)"
        >
          <span class="thumb">
            <span
              class="art"
              :class="{ sheet: hasWalkSheet(entry.sprite) }"
              :style="spriteArtStyle(entry.sprite, entry.hue)"
              aria-hidden="true"
            />
            <span
              v-if="entry.isNew"
              class="badge"
            >NEW</span>
          </span>
          <span class="name">{{ shownName(entry) }}</span>
          <span
            v-if="warningTitle(entry.behavior)"
            class="tip"
          >
            <strong>{{ warningTitle(entry.behavior) }}</strong>
            <span>{{ warningMessage(entry.behavior) }}</span>
          </span>
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="confirm"
      @click="emit('confirm')"
    >
      {{ t("wave.confirm") }}
    </button>
  </div>
</template>

<style scoped>
.wave-preview {
  position: absolute;
  top: 72px;
  left: 50%;
  z-index: 3;
  width: min(560px, calc(100% - 24px));
  padding: 10px 12px 12px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.94);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.4);
  color: #f7efe6;
  font: 700 13px/1.3 "Segoe UI", sans-serif;
  pointer-events: none;
  transform: translateX(-50%);
}

.title {
  margin: 0 0 8px;
  text-align: center;
  letter-spacing: 0.04em;
}

.roster {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 76px;
  margin: 0;
  padding: 6px 4px;
  border: 0;
  border-radius: 8px;
  background: rgba(20, 12, 10, 0.88);
  color: inherit;
  font: inherit;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.22);
  pointer-events: auto;
}

.entry.fresh {
  box-shadow: inset 0 0 0 2px #e8b060;
}

.entry.breaker {
  box-shadow: inset 0 0 0 2px #ff6b3d;
}

.entry.ambush {
  box-shadow: inset 0 0 0 2px #b07cff;
}

.entry:hover,
.entry:focus-visible {
  z-index: 2;
}

.confirm {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #e8b060;
  color: #2a1810;
  font: inherit;
  letter-spacing: 0.04em;
  cursor: pointer;
  pointer-events: auto;
}

.confirm:hover,
.confirm:focus-visible {
  background: #f2c98a;
}

.tip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  z-index: 3;
  width: 168px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(18, 10, 8, 0.98);
  box-shadow: inset 0 0 0 1px rgba(247, 239, 230, 0.28);
  color: #f7efe6;
  font: 600 12px/1.35 "Segoe UI", sans-serif;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  transform: translateX(-50%);
}

.entry.breaker .tip {
  box-shadow: inset 0 0 0 1px #ff6b3d;
}

.entry.ambush .tip {
  box-shadow: inset 0 0 0 1px #b07cff;
}

.entry:hover .tip,
.entry:focus .tip,
.entry:focus-visible .tip {
  display: block;
}

.tip strong {
  display: block;
  margin-bottom: 2px;
}

.entry.breaker .tip strong {
  color: #ffb199;
}

.entry.ambush .tip strong {
  color: #d7c2ff;
}

.thumb {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 4px;
  background-color: #1a1412;
}

.art {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  background-repeat: no-repeat;
}

.art.sheet {
  background-size: 600% 100%;
  background-position: 0 0;
}

.name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
