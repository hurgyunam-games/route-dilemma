<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
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
  type CampaignLoad,
  type MapId,
  type Tower,
} from "@/core";

const loadSavedCampaign = (): CampaignLoad => {
  try {
    return loadCampaign(window.localStorage);
  } catch {
    return { status: "invalid", progress: createCampaign(), saveVersion: null };
  }
};

const saved = loadSavedCampaign();
const campaign = ref(saved.progress);
const saveStatus = ref(saved.status);
const selectedMapId = ref<MapId | null>(null);
const selectedStageId = ref<number | null>(null);
const lastMapId = ref<MapId | null>(null);
type ToolPage = "gallery" | "waves" | "enemies";

const SpriteGalleryView = import.meta.env.DEV
  ? defineAsyncComponent(() => import("@/ui/SpriteGalleryView.vue"))
  : undefined;
const WaveEditorView = import.meta.env.DEV
  ? defineAsyncComponent(() => import("@/ui/WaveEditorView.vue"))
  : undefined;
const EnemyEditorView = import.meta.env.DEV
  ? defineAsyncComponent(() => import("@/ui/EnemyEditorView.vue"))
  : undefined;

const pageFromHash = (): ToolPage | null => {
  if (!import.meta.env.DEV) {
    return null;
  }
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "gallery" || hash === "waves" || hash === "enemies" ? hash : null;
};

const toolPage = ref<ToolPage | null>(pageFromHash());

const syncHash = (): void => {
  toolPage.value = pageFromHash();
};

const openTool = (page: ToolPage): void => {
  if (!import.meta.env.DEV) {
    return;
  }
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
  if (saveStatus.value === "newer") {
    return;
  }
  try {
    if (persistCampaign(window.localStorage, next) && saveStatus.value !== "ok") {
      saveStatus.value = "ok";
    }
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
  if (!import.meta.env.DEV) {
    return;
  }
  window.addEventListener("hashchange", syncHash);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", syncHash);
});
</script>

<template>
  <component
    :is="SpriteGalleryView"
    v-if="toolPage === 'gallery'"
    @leave="leaveTool"
  />
  <component
    :is="WaveEditorView"
    v-else-if="toolPage === 'waves'"
    @leave="leaveTool"
  />
  <component
    :is="EnemyEditorView"
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
    :save-status="saveStatus"
    @select="enterMap"
    @gallery="openTool('gallery')"
    @waves="openTool('waves')"
    @enemies="openTool('enemies')"
  />
</template>
