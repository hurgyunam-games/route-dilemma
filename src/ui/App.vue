<script setup lang="ts">
import { ref } from "vue";
import BattleView from "@/ui/BattleView.vue";
import WorldMapView from "@/ui/WorldMapView.vue";
import {
  createCampaign,
  isMapUnlocked,
  loadCampaign,
  persistCampaign,
  playableStage,
  recordVictory,
  saveMapTowers,
  towersForMap,
  type MapId,
  type Tower,
} from "@/core";

const loadSavedCampaign = () => {
  try {
    return loadCampaign(window.localStorage);
  } catch {
    return createCampaign();
  }
};

const campaign = ref(loadSavedCampaign());
const selectedMapId = ref<MapId | null>(null);
const selectedStageId = ref<number | null>(null);
const lastMapId = ref<MapId | null>(null);

const commit = (next: typeof campaign.value): void => {
  campaign.value = next;
  try {
    persistCampaign(window.localStorage, next);
  } catch {
    /* storage may be blocked */
  }
};

const enterMap = (id: MapId): void => {
  if (!isMapUnlocked(campaign.value, id)) {
    return;
  }
  selectedMapId.value = id;
  selectedStageId.value = playableStage(campaign.value, id);
  lastMapId.value = id;
};

const leaveBattle = (): void => {
  selectedMapId.value = null;
  selectedStageId.value = null;
};

const onVictory = (stageId: number): void => {
  commit(recordVictory(campaign.value, stageId));
};

const onSaveTowers = (towers: readonly Tower[]): void => {
  if (selectedMapId.value === null) {
    return;
  }
  commit(saveMapTowers(campaign.value, selectedMapId.value, towers));
};
</script>

<template>
  <BattleView
    v-if="selectedMapId !== null && selectedStageId !== null"
    :key="`${selectedMapId}-${selectedStageId}`"
    :map-id="selectedMapId"
    :stage-id="selectedStageId"
    :towers="towersForMap(campaign, selectedMapId)"
    @leave="leaveBattle"
    @victory="onVictory"
    @save-towers="onSaveTowers"
  />
  <WorldMapView
    v-else
    :last-map-id="lastMapId"
    :progress="campaign"
    @select="enterMap"
  />
</template>
