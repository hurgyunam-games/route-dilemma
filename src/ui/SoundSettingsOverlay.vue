<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  getAudioSettings,
  setAudioChannel,
  subscribeAudioSettings,
  type AudioChannel,
  type AudioSettings,
} from "@/render/audio-settings";
import { t, type MessageKey } from "@/ui/i18n";

const emit = defineEmits<{
  close: [];
  credits: [];
}>();

const settings = ref<AudioSettings>(getAudioSettings());
let unsubscribe = (): void => {};

const ROWS: readonly { channel: AudioChannel; label: MessageKey }[] = [
  { channel: "master", label: "sound.master" },
  { channel: "sfx", label: "sound.sfx" },
  { channel: "bgm", label: "sound.bgm" },
];

const percent = (channel: AudioChannel): number => Math.round(settings.value[channel] * 100);

const onInput = (channel: AudioChannel, event: Event): void => {
  const raw = Number((event.target as HTMLInputElement).value);
  settings.value = setAudioChannel(channel, raw / 100);
};

onMounted(() => {
  unsubscribe = subscribeAudioSettings((next) => {
    settings.value = next;
  });
});

onUnmounted(() => {
  unsubscribe();
});
</script>

<template>
  <div
    class="sound-overlay"
    @click.self="emit('close')"
  >
    <div
      class="sound-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('sound.aria')"
    >
      <header class="sound-head">
        <h2>{{ t("sound.title") }}</h2>
        <button
          type="button"
          class="close"
          @click="emit('close')"
        >
          {{ t("common.close") }}
        </button>
      </header>
      <label
        v-for="row in ROWS"
        :key="row.channel"
        class="sound-row"
      >
        <span class="sound-name">{{ t(row.label) }}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          :value="percent(row.channel)"
          :aria-label="t('sound.volume', { name: t(row.label) })"
          @input="onInput(row.channel, $event)"
        >
        <span class="sound-pct">{{ percent(row.channel) }}%</span>
      </label>
      <p class="sound-note">
        {{ t("sound.note") }}
      </p>
      <button
        type="button"
        class="credits-btn"
        @click="emit('credits')"
      >
        {{ t("sound.credits") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sound-overlay {
  position: fixed;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.55);
  pointer-events: auto;
}

.sound-panel {
  width: min(420px, calc(100% - 32px));
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.4);
  color: #f7efe6;
  font: 700 14px/1.4 "Segoe UI", sans-serif;
}

.sound-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.sound-head h2 {
  margin: 0;
  font-size: 16px;
}

.close,
.credits-btn {
  margin: 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(56, 38, 28, 0.95);
  color: #f7efe6;
  font: 700 13px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.45);
}

.close:focus-visible,
.credits-btn:focus-visible,
.sound-row input:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 2px;
}

.sound-row {
  display: grid;
  grid-template-columns: minmax(7.5rem, auto) 1fr 48px;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.sound-name,
.sound-pct {
  font-variant-numeric: tabular-nums;
}

.sound-pct {
  text-align: right;
  color: #e8b060;
}

.sound-row input {
  width: 100%;
  accent-color: #e8b060;
  cursor: pointer;
}

.sound-note {
  margin: 4px 0 12px;
  color: #d8cfc6;
  font: 600 13px/1.45 "Segoe UI", sans-serif;
}

.credits-btn {
  padding: 8px 14px;
}
</style>
