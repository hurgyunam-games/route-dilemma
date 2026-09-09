<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import BattleView from "@/ui/BattleView.vue";
import SpriteGalleryView from "@/ui/SpriteGalleryView.vue";
import WaveEditorView from "@/ui/WaveEditorView.vue";
import EnemyEditorView from "@/ui/EnemyEditorView.vue";
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
type ToolPage = "gallery" | "waves" | "enemies";

const pageFromHash = (): ToolPage | null => {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "gallery" || hash === "waves" || hash === "enemies" ? hash : null;
};

const toolPage = ref<ToolPage | null>(pageFromHash());

const syncHash = (): void => {
  toolPage.value = pageFromHash();
};

const openTool = (page: ToolPage): void => {
  toolPage.value = page;
  window.location.hash = page;
};

const leaveTool = (): void => {
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url);
  toolPage.value = null;
};

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

onMounted(() => {
  window.addEventListener("hashchange", syncHash);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", syncHash);
});
</script>

<template>
  <SpriteGalleryView
    v-if="toolPage === 'gallery'"
    @leave="leaveTool"
  />
  <WaveEditorView
    v-else-if="toolPage === 'waves'"
    @leave="leaveTool"
  />
  <EnemyEditorView
    v-else-if="toolPage === 'enemies'"
    @leave="leaveTool"
  />
  <BattleView
    v-else-if="selectedMapId !== null && selectedStageId !== null"
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
    @gallery="openTool('gallery')"
    @waves="openTool('waves')"
    @enemies="openTool('enemies')"
  />
</template>
