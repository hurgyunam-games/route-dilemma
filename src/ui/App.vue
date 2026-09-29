<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
import BattleView from "@/ui/BattleView.vue";
import SaveListView from "@/ui/SaveListView.vue";
import WorldMapView from "@/ui/WorldMapView.vue";
import {
  addSaveSlot,
  canEnterMap,
  createCampaign,
  loadSaveList,
  persistSaveList,
  playableStage,
  recordDefeat,
  recordVictory,
  removeSaveSlot,
  saveMapTowers,
  startMapRecapture,
  towersForMap,
  updateSaveSlot,
  markBehaviorWarnings,
  unlockBestiaryEnemies,
  unlockResearchBuff,
  type CampaignLoadStatus,
  type CampaignProgress,
  type MapId,
  type ResearchBuffId,
  type SaveListLoad,
  type Tower,
} from "@/core";
import { resumeBgm, startBattleBgm, startWorldBgm } from "@/render/bgm";

const loadSavedList = (): SaveListLoad => {
  try {
    return loadSaveList(window.localStorage);
  } catch {
    return { status: "invalid", list: { slots: [] }, preserved: {} };
  }
};

const saved = loadSavedList();
const saveList = ref(saved.list);
const preservedCampaigns = ref(saved.preserved);
const listStatus = ref<CampaignLoadStatus>(saved.status);
const activeId = ref<string | null>(null);
const campaign = ref(createCampaign());
const saveStatus = ref<CampaignLoadStatus>("ok");
const selectedMapId = ref<MapId | null>(null);
const selectedStageId = ref<number | null>(null);
const lastMapId = ref<MapId | null>(null);
const recaptureOnLeave = ref<MapId | null>(null);
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

const persistList = (): void => {
  if (listStatus.value === "newer") {
    return;
  }
  try {
    persistSaveList(window.localStorage, saveList.value, preservedCampaigns.value);
  } catch {
    /* storage may be blocked */
  }
};

const openSlot = (id: string): void => {
  const slot = saveList.value.slots.find((entry) => entry.id === id);
  if (!slot || slot.status === "newer" || slot.status === "invalid" || listStatus.value === "newer") {
    return;
  }
  activeId.value = id;
  campaign.value = slot.progress;
  saveStatus.value = "ok";
  selectedMapId.value = null;
  selectedStageId.value = null;
};

const showSaveList = (): void => {
  selectedMapId.value = null;
  selectedStageId.value = null;
  activeId.value = null;
};

const onCreateSave = (): void => {
  if (listStatus.value === "newer") {
    return;
  }
  const added = addSaveSlot(saveList.value, Date.now());
  saveList.value = added.list;
  persistList();
  openSlot(added.slot.id);
};

const onDeleteSave = (id: string): void => {
  if (listStatus.value === "newer") {
    return;
  }
  saveList.value = removeSaveSlot(saveList.value, id);
  if (Object.prototype.hasOwnProperty.call(preservedCampaigns.value, id)) {
    const next = { ...preservedCampaigns.value };
    delete next[id];
    preservedCampaigns.value = next;
  }
  if (activeId.value === id) {
    activeId.value = null;
  }
  persistList();
};

const commit = (next: CampaignProgress): void => {
  campaign.value = next;
  if (listStatus.value === "newer" || saveStatus.value === "newer" || activeId.value === null) {
    return;
  }
  saveList.value = updateSaveSlot(saveList.value, activeId.value, next, Date.now());
  try {
    if (persistSaveList(window.localStorage, saveList.value, preservedCampaigns.value)) {
      saveStatus.value = "ok";
    }
  } catch {
    /* storage may be blocked */
  }
};

const enterMap = (id: MapId): void => {
  if (!canEnterMap(campaign.value, id, Date.now())) {
    return;
  }
  startBattleBgm(id);
  selectedMapId.value = id;
  selectedStageId.value = playableStage(campaign.value, id);
  lastMapId.value = id;
};

const leaveBattle = (): void => {
  if (recaptureOnLeave.value !== null) {
    commit(startMapRecapture(campaign.value, recaptureOnLeave.value, Date.now()));
    recaptureOnLeave.value = null;
  }
  selectedMapId.value = null;
  selectedStageId.value = null;
};

const onVictory = (stageId: number): void => {
  commit(recordVictory(campaign.value, stageId));
};

const onDefeat = (towers: readonly Tower[]): void => {
  if (selectedMapId.value === null) {
    return;
  }
  recaptureOnLeave.value = selectedMapId.value;
  commit(recordDefeat(campaign.value, selectedMapId.value, towers, Date.now()));
};

const onSaveTowers = (towers: readonly Tower[]): void => {
  if (selectedMapId.value === null) {
    return;
  }
  commit(saveMapTowers(campaign.value, selectedMapId.value, towers));
};

const onUnlockBestiary = (enemyIds: readonly string[]): void => {
  commit(unlockBestiaryEnemies(campaign.value, enemyIds));
};

const onWarnBehaviors = (behaviors: readonly string[]): void => {
  commit(markBehaviorWarnings(campaign.value, behaviors));
};

const onUnlockResearch = (buffId: ResearchBuffId): void => {
  const result = unlockResearchBuff(campaign.value, buffId);
  if (!result.ok) {
    return;
  }
  commit(result.progress);
};

const onSaveResearch = (points: number): void => {
  if (campaign.value.researchPoints === points) {
    return;
  }
  commit({ ...campaign.value, researchPoints: points });
};

onMounted(() => {
  startWorldBgm();
  window.addEventListener("pointerdown", resumeBgm, { once: true });
  if (!import.meta.env.DEV) {
    return;
  }
  window.addEventListener("hashchange", syncHash);
});

onUnmounted(() => {
  window.removeEventListener("pointerdown", resumeBgm);
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
    :bestiary-unlocked="campaign.bestiaryUnlocked"
    :warned-behaviors="campaign.warnedBehaviors"
    :research-points="campaign.researchPoints"
    :research-buffs="campaign.researchBuffs"
    @leave="leaveBattle"
    @victory="onVictory"
    @defeat="onDefeat"
    @save-towers="onSaveTowers"
    @unlock-bestiary="onUnlockBestiary"
    @warn-behaviors="onWarnBehaviors"
    @save-research="onSaveResearch"
  />
  <WorldMapView
    v-else-if="activeId !== null"
    :last-map-id="lastMapId"
    :progress="campaign"
    :save-status="saveStatus"
    @select="enterMap"
    @saves="showSaveList"
    @gallery="openTool('gallery')"
    @waves="openTool('waves')"
    @enemies="openTool('enemies')"
    @unlock-research="onUnlockResearch"
  />
  <SaveListView
    v-else
    :slots="saveList.slots"
    :list-status="listStatus"
    @create="onCreateSave"
    @open="openSlot"
    @remove="onDeleteSave"
  />
</template>
