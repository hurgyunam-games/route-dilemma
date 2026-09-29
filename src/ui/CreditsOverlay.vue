<script setup lang="ts">
import { t, type MessageKey } from "@/ui/i18n";

const emit = defineEmits<{
  close: [];
}>();

const CREDITS: readonly {
  kind: MessageKey;
  author: string;
  title: string;
  note: MessageKey | "";
  href: string;
}[] = [
  {
    kind: "credits.music",
    author: "xDeviruchi",
    title: "16-bit Fantasy & Adventure Music Pack",
    note: "credits.tracks",
    href: "https://xdeviruchi.itch.io/16-bit-fantasy-adventure-music-pack",
  },
  {
    kind: "credits.sfx",
    author: "Leohpaz",
    title: "RPG Essentials SFX Free",
    note: "",
    href: "https://leohpaz.itch.io/rpg-essentials-sfx-free",
  },
  {
    kind: "credits.sfx",
    author: "Leohpaz",
    title: "Minifantasy Dungeon SFX Pack",
    note: "",
    href: "https://leohpaz.itch.io/minifantasy-dungeon-sfx-pack",
  },
  {
    kind: "credits.art",
    author: "itch.io",
    title: "Tower Defense Top-Down Pixel Assets",
    note: "",
    href: "https://itch.io/c/3550377/tower-defense-top-down-pixel-assets",
  },
];

const noteText = (note: MessageKey | ""): string => (note ? t(note) : "");
</script>

<template>
  <div
    class="credits-overlay"
    @click.self="emit('close')"
  >
    <div
      class="credits-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('credits.aria')"
    >
      <header class="credits-head">
        <h2>{{ t("credits.title") }}</h2>
        <button
          type="button"
          class="close"
          @click="emit('close')"
        >
          {{ t("common.close") }}
        </button>
      </header>
      <p class="credits-lead">
        {{ t("credits.lead") }}
      </p>
      <ul class="credits-list">
        <li
          v-for="credit in CREDITS"
          :key="credit.href"
        >
          <p class="credits-kind">
            {{ t(credit.kind) }}
          </p>
          <p class="credits-title">
            {{ credit.author }} — {{ credit.title }}
          </p>
          <p
            v-if="credit.note"
            class="credits-note"
          >
            {{ noteText(credit.note) }}
          </p>
          <a
            :href="credit.href"
            target="_blank"
            rel="noopener noreferrer"
          >{{ credit.href }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.credits-overlay {
  position: fixed;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 5, 0.55);
  pointer-events: auto;
}

.credits-panel {
  width: min(560px, calc(100% - 32px));
  max-height: min(640px, calc(100% - 32px));
  overflow: auto;
  padding: 16px 18px 18px;
  border-radius: 10px;
  background: rgba(28, 18, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.4);
  color: #f7efe6;
  font: 700 14px/1.4 "Segoe UI", sans-serif;
}

.credits-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.credits-head h2 {
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
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.45);
}

.close:focus-visible,
.credits-list a:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 2px;
}

.credits-lead {
  margin: 0 0 12px;
  color: #d8cfc6;
  font: 600 13px/1.45 "Segoe UI", sans-serif;
}

.credits-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.credits-list li {
  padding-top: 12px;
  border-top: 1px solid rgba(216, 207, 198, 0.16);
}

.credits-kind,
.credits-title,
.credits-note {
  margin: 0;
}

.credits-kind {
  color: #e8b060;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.credits-title {
  margin-top: 2px;
}

.credits-note {
  margin-top: 2px;
  color: #d8cfc6;
  font-weight: 600;
}

.credits-list a {
  display: inline-block;
  margin-top: 4px;
  color: #9fd0e8;
  font: 600 12px/1.4 "Segoe UI", sans-serif;
  word-break: break-all;
}
</style>
