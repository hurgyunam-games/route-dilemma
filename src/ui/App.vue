<script setup lang="ts">
import { ref } from "vue";
import BattleView from "@/ui/BattleView.vue";
import WorldMapView from "@/ui/WorldMapView.vue";
import type { MapId } from "@/core";

const selectedMapId = ref<MapId | null>(null);
const lastMapId = ref<MapId | null>(null);

const enterMap = (id: MapId): void => {
  selectedMapId.value = id;
  lastMapId.value = id;
};

const leaveBattle = (): void => {
  selectedMapId.value = null;
};
</script>

<template>
  <BattleView
    v-if="selectedMapId !== null"
    :key="selectedMapId"
    :map-id="selectedMapId"
    @leave="leaveBattle"
  />
  <WorldMapView
    v-else
    :last-map-id="lastMapId"
    @select="enterMap"
  />
</template>
