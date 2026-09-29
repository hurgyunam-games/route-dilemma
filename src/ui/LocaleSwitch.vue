<script setup lang="ts">
import { locale, setLocale, t, type LocaleId } from "@/ui/i18n";

const options: readonly { id: LocaleId; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
];
</script>

<template>
  <div
    class="locale-switch"
    role="group"
    :aria-label="t('locale.group')"
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :class="{ on: locale === option.id }"
      :aria-pressed="locale === option.id"
      @click="setLocale(option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.locale-switch {
  display: inline-flex;
  gap: 6px;
}

.locale-switch button {
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

.locale-switch button.on {
  background: #e8b060;
  color: #2a1810;
  box-shadow: none;
}

.locale-switch button:focus-visible {
  outline: 2px solid #e8b060;
  outline-offset: 3px;
}
</style>
