<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import {
  ENEMY_BEHAVIOR_LABELS,
  ENEMY_SPRITE_LABELS,
  MAX_WAVE_SPAWNS_PER_BURST,
  MAX_WAVE_STAGES,
  MIN_WAVE_STAGES,
  WORLD_MAP_COUNT,
  bundledWaveTable,
  cloneWaveTable,
  defaultStageWave,
  defaultWaveBurst,
  defaultWaveSpawn,
  enemyCount,
  enemySpawnDurationSec,
  getEnemyCatalog,
  getWaveTable,
  insertWaveSpawn,
  moveWaveSpawn,
  normalizeHue,
  parseWaveTableJson,
  resetWaveTable,
  serializeWaveTable,
  setWaveTable,
  tryGetEnemy,
  type EnemyDef,
  type EnemyTypeId,
  type StageWaveRow,
  type WaveBurstRow,
  type WaveSpawnRef,
  type WaveTable,
} from "@/core";
import { enemyWalkPreview } from "@/render/enemy-sprites";

const emit = defineEmits<{
  leave: [];
}>();

const catalog = ref(getEnemyCatalog());
const selectedPalette = ref(catalog.value[0]?.id ?? "");

const draft = ref<WaveTable>(cloneWaveTable(getWaveTable()));
const selected = ref(0);
const jsonText = ref(serializeWaveTable(draft.value));
const jsonDirty = ref(false);
const status = ref("");
const copyHint = ref("");
const dragging = ref<{ burst: number; index: number } | null>(null);
const dragOver = ref<{ burst: number; index: number } | null>(null);
const paletteDrag = ref<string | null>(null);
const selectedBurst = ref(0);
const rightTab = ref<"palette" | "json">("palette");

watch(
  draft,
  (table) => {
    if (!jsonDirty.value) {
      jsonText.value = serializeWaveTable(table);
    }
  },
  { deep: true },
);

const stage = computed(() => draft.value.stages[selected.value] ?? null);

const spawnDef = (unit: WaveSpawnRef): EnemyDef | null => tryGetEnemy(unit.enemyId);

const hueFilter = (hue: number): string => {
  const deg = normalizeHue(hue);
  return deg === 0 ? "none" : `hue-rotate(${deg}deg)`;
};

const spriteStyle = (sprite: EnemyTypeId, hue = 0): CSSProperties => {
  const preview = enemyWalkPreview(sprite);
  const filter = hueFilter(hue);
  if (preview.url) {
    return {
      backgroundImage: `url(${preview.url})`,
      backgroundSize: `${preview.cols * 100}% 100%`,
      backgroundPosition: "0 0",
      backgroundRepeat: "no-repeat",
      backgroundColor: "transparent",
      filter,
    };
  }
  return { backgroundColor: preview.fallback, filter };
};

const hasWalkSheet = (sprite: EnemyTypeId): boolean => Boolean(enemyWalkPreview(sprite).url);

const spawnThumbStyle = (unit: WaveSpawnRef): CSSProperties => {
  const def = spawnDef(unit);
  if (!def) {
    return { backgroundColor: "#3a3228" };
  }
  return spriteStyle(def.sprite, def.hue);
};

const spawnHasSheet = (unit: WaveSpawnRef): boolean => {
  const def = spawnDef(unit);
  return def ? hasWalkSheet(def.sprite) : false;
};

const spawnLine = (unit: WaveSpawnRef): string => {
  const def = spawnDef(unit);
  if (!def) {
    return `${unit.enemyId} (없는 적)`;
  }
  const hue = def.hue ? ` · 색조 ${def.hue}` : "";
  const behavior = def.behavior === "breaker" ? ` · ${ENEMY_BEHAVIOR_LABELS.breaker}` : "";
  return `${def.name} · ${ENEMY_SPRITE_LABELS[def.sprite]} · HP ${def.hp}${behavior}${hue}`;
};

const rowMaxHp = (row: StageWaveRow): number =>
  Math.max(
    0,
    ...row.bursts.flatMap((burst) => burst.units.map((unit) => spawnDef(unit)?.hp ?? 0)),
  );

const spawnSec = computed(() => (stage.value ? enemySpawnDurationSec(stage.value) : 0));

const loopHint = computed(() => {
  const row = stage.value;
  const count = draft.value.stages.length;
  if (!row) {
    return "";
  }
  const lastStart = count - WORLD_MAP_COUNT + 1;
  if (row.id < lastStart) {
    return "";
  }
  const loopId = count + (row.id - lastStart) + 1;
  return `스테이지 ${loopId} 루프는 이 행을 템플릿으로 씁니다. HP·수가 가산됩니다.`;
});

const canRemoveStage = computed(() => draft.value.stages.length > MIN_WAVE_STAGES);
const canAddStage = computed(() => draft.value.stages.length < MAX_WAVE_STAGES);

const setStatus = (text: string): void => {
  status.value = text;
};

const selectStage = (index: number): void => {
  selected.value = index;
  selectedBurst.value = 0;
};

const replaceStages = (stages: readonly StageWaveRow[], nextSelected = selected.value): void => {
  draft.value = { stages };
  selected.value = Math.max(0, Math.min(nextSelected, stages.length - 1));
  const bursts = stages[selected.value]?.bursts.length ?? 1;
  selectedBurst.value = Math.max(0, Math.min(selectedBurst.value, bursts - 1));
};

const updateStage = (patch: Partial<StageWaveRow>): void => {
  const current = stage.value;
  if (!current) {
    return;
  }
  replaceStages(
    draft.value.stages.map((row, index) => (index === selected.value ? { ...row, ...patch } : row)),
  );
};

const updateBurst = (burstIndex: number, patch: Partial<WaveBurstRow>): void => {
  const current = stage.value;
  if (!current) {
    return;
  }
  updateStage({
    bursts: current.bursts.map((burst, index) =>
      index === burstIndex ? { ...burst, ...patch } : burst,
    ),
  });
};

const readNumber = (event: Event): number | null => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return null;
  }
  const value = Number(target.value);
  return Number.isFinite(value) ? value : null;
};

const setStageNumber = (key: keyof StageWaveRow, event: Event, integer = false): void => {
  const value = readNumber(event);
  if (value === null) {
    return;
  }
  updateStage({ [key]: integer ? Math.round(value) : value });
};

const setBurstNumber = (
  burstIndex: number,
  key: "interval" | "restAfter",
  event: Event,
): void => {
  const value = readNumber(event);
  if (value === null) {
    return;
  }
  updateBurst(burstIndex, { [key]: value });
};

const addBurst = (): void => {
  const current = stage.value;
  if (!current) {
    return;
  }
  const last = current.bursts[current.bursts.length - 1];
  updateStage({
    bursts: [
      ...current.bursts,
      last ? { ...last, units: last.units.map((spawn) => ({ ...spawn })) } : defaultWaveBurst(),
    ],
  });
  selectedBurst.value = current.bursts.length;
};

const removeBurst = (burstIndex: number): void => {
  const current = stage.value;
  if (!current || current.bursts.length <= 1) {
    return;
  }
  updateStage({
    bursts: current.bursts.filter((_, index) => index !== burstIndex),
  });
};

const paletteSpawn = (): WaveSpawnRef => {
  if (selectedPalette.value && tryGetEnemy(selectedPalette.value)) {
    return { enemyId: selectedPalette.value };
  }
  return defaultWaveSpawn();
};

const addSpawn = (burstIndex: number, spawn: WaveSpawnRef = paletteSpawn()): void => {
  const current = stage.value;
  if (!current) {
    return;
  }
  selectedBurst.value = burstIndex;
  updateStage({
    bursts: insertWaveSpawn(current.bursts, burstIndex, current.bursts[burstIndex]?.units.length ?? 0, spawn),
  });
};

const removeSpawn = (burstIndex: number, spawnIndex: number): void => {
  const burst = stage.value?.bursts[burstIndex];
  if (!burst || burst.units.length <= 1) {
    return;
  }
  updateBurst(burstIndex, {
    units: burst.units.filter((_, index) => index !== spawnIndex),
  });
};

const addPaletteEnemy = (enemyId: string): void => {
  selectedPalette.value = enemyId;
  if (!stage.value) {
    return;
  }
  addSpawn(selectedBurst.value, { enemyId });
};

const onPaletteDragStart = (enemyId: string, event: DragEvent): void => {
  paletteDrag.value = enemyId;
  dragging.value = null;
  selectedPalette.value = enemyId;
  event.dataTransfer?.setData("text/plain", `palette:${enemyId}`);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
  }
};

const onDragStart = (burstIndex: number, spawnIndex: number, event: DragEvent): void => {
  dragging.value = { burst: burstIndex, index: spawnIndex };
  paletteDrag.value = null;
  dragOver.value = null;
  event.dataTransfer?.setData("text/plain", `${burstIndex}:${spawnIndex}`);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const onDragOver = (burstIndex: number, spawnIndex: number, event: DragEvent): void => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = paletteDrag.value ? "copy" : "move";
  }
  dragOver.value = { burst: burstIndex, index: spawnIndex };
};

const onDrop = (burstIndex: number, spawnIndex: number, event: DragEvent): void => {
  event.preventDefault();
  const from = dragging.value;
  const palette = paletteDrag.value;
  dragging.value = null;
  paletteDrag.value = null;
  dragOver.value = null;
  if (!stage.value) {
    return;
  }
  selectedBurst.value = burstIndex;
  if (palette) {
    updateStage({
      bursts: insertWaveSpawn(stage.value.bursts, burstIndex, spawnIndex, { enemyId: palette }),
    });
    return;
  }
  if (!from) {
    return;
  }
  updateStage({
    bursts: moveWaveSpawn(stage.value.bursts, from.burst, from.index, burstIndex, spawnIndex),
  });
};

const onDragEnd = (): void => {
  dragging.value = null;
  paletteDrag.value = null;
  dragOver.value = null;
};

const openEnemies = (): void => {
  window.location.hash = "enemies";
};

const isDragging = (burstIndex: number, spawnIndex: number): boolean =>
  dragging.value?.burst === burstIndex && dragging.value.index === spawnIndex;

const isDragOver = (burstIndex: number, spawnIndex: number): boolean =>
  dragOver.value?.burst === burstIndex &&
  dragOver.value.index === spawnIndex &&
  !isDragging(burstIndex, spawnIndex);

const addStage = (): void => {
  if (!canAddStage.value) {
    return;
  }
  const last = draft.value.stages[draft.value.stages.length - 1];
  const next = defaultStageWave(draft.value.stages.length + 1, last);
  replaceStages([...draft.value.stages, next], draft.value.stages.length);
};

const duplicateStage = (): void => {
  if (!canAddStage.value || !stage.value) {
    return;
  }
  const insertAt = selected.value + 1;
  const stages = [
    ...draft.value.stages.slice(0, insertAt),
    defaultStageWave(0, stage.value),
    ...draft.value.stages.slice(insertAt),
  ].map((row, index) => ({ ...row, id: index + 1 }));
  replaceStages(stages, insertAt);
};

const removeStage = (): void => {
  if (!canRemoveStage.value) {
    return;
  }
  const stages = draft.value.stages
    .filter((_, index) => index !== selected.value)
    .map((row, index) => ({ ...row, id: index + 1 }));
  replaceStages(stages, Math.min(selected.value, stages.length - 1));
};

const applyJson = (): void => {
  const parsed = parseWaveTableJson(jsonText.value);
  if (!parsed.ok) {
    setStatus(parsed.reason);
    return;
  }
  jsonDirty.value = false;
  replaceStages(parsed.table.stages, selected.value);
  jsonText.value = serializeWaveTable(parsed.table);
  setStatus("JSON을 폼에 반영했습니다");
};

const applySession = (): string | null => {
  const parsed = parseWaveTableJson(serializeWaveTable(draft.value));
  if (!parsed.ok) {
    setStatus(parsed.reason);
    return null;
  }
  setWaveTable(parsed.table);
  jsonDirty.value = false;
  replaceStages(parsed.table.stages, selected.value);
  jsonText.value = serializeWaveTable(parsed.table);
  return serializeWaveTable(parsed.table);
};

const applyToBattle = (): void => {
  if (applySession()) {
    setStatus("배틀 세션에 적용했습니다. 월드맵에서 스테이지를 다시 들어가면 반영됩니다.");
  }
};

const saveFile = async (): Promise<void> => {
  const body = applySession();
  if (!body) {
    return;
  }
  try {
    const res = await fetch("/__wave-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const detail = await res.text();
      setStatus(`세션에 적용됨 · 파일 저장 실패${detail ? `: ${detail}` : ""}`);
      return;
    }
    setStatus("src/core/waves.json에 저장하고 배틀에 적용했습니다");
  } catch {
    setStatus("세션에 적용됨 · 파일 저장은 개발 서버에서만 됩니다");
  }
};

const copyJson = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(serializeWaveTable(draft.value));
    copyHint.value = "복사됨";
  } catch {
    copyHint.value = "복사 실패";
  }
  window.setTimeout(() => {
    copyHint.value = "";
  }, 1200);
};

const restoreBundled = (): void => {
  jsonDirty.value = false;
  replaceStages(bundledWaveTable().stages, selected.value);
  resetWaveTable();
  setStatus("번들 기본값으로 되돌렸습니다. 파일은 저장 버튼을 눌러야 바뀝니다.");
};

const onJsonInput = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) {
    return;
  }
  jsonDirty.value = true;
  jsonText.value = target.value;
};
</script>

<template>
  <div class="editor">
    <header class="head">
      <button
        type="button"
        class="back"
        @click="emit('leave')"
      >
        월드맵
      </button>
      <div class="title">
        <h1>웨이브 에디터</h1>
        <p>
          오른쪽 팔레트에서 적을 골라 버스트에 넣습니다. 저장하면
          <code>src/core/waves.json</code>에 쓰고, 배틀은 스테이지를 다시 들어가야 반영됩니다.
        </p>
      </div>
      <div class="actions">
        <button
          type="button"
          @click="openEnemies"
        >
          적 에디터
        </button>
        <button
          type="button"
          @click="applyToBattle"
        >
          세션 적용
        </button>
        <button
          type="button"
          class="primary"
          @click="saveFile"
        >
          파일 저장
        </button>
        <button
          type="button"
          class="ghost"
          @click="restoreBundled"
        >
          기본값
        </button>
      </div>
    </header>
    <p
      v-if="status"
      class="status"
    >
      {{ status }}
    </p>
    <div class="body">
      <aside class="stage-list">
        <div class="stage-tools">
          <button
            type="button"
            :disabled="!canAddStage"
            @click="addStage"
          >
            스테이지 추가
          </button>
          <button
            type="button"
            :disabled="!canAddStage"
            @click="duplicateStage"
          >
            복제
          </button>
          <button
            type="button"
            class="danger"
            :disabled="!canRemoveStage"
            @click="removeStage"
          >
            삭제
          </button>
        </div>
        <ol>
          <li
            v-for="(row, index) in draft.stages"
            :key="row.id"
          >
            <button
              type="button"
              :class="{ on: index === selected }"
              @click="selectStage(index)"
            >
              <span>스테이지 {{ row.id }}</span>
              <span class="meta">
                적 {{ enemyCount(row) }} · HP {{ rowMaxHp(row) }} · {{ row.enemyPhaseSec }}s
              </span>
            </button>
          </li>
        </ol>
      </aside>
      <section
        v-if="stage"
        class="form"
      >
        <h2>스테이지 {{ stage.id }}</h2>
        <p
          v-if="loopHint"
          class="hint gold"
        >
          {{ loopHint }}
        </p>
        <p class="hint">
          적 {{ enemyCount(stage) }}마리 · 스폰 약 {{ spawnSec.toFixed(1) }}s /
          적 페이즈 {{ stage.enemyPhaseSec }}s · 아군 {{ stage.allyCount }}명
        </p>
        <div class="fields">
          <label>
            적 페이즈 (초)
            <input
              type="number"
              min="1"
              step="1"
              :value="stage.enemyPhaseSec"
              @change="setStageNumber('enemyPhaseSec', $event)"
            >
          </label>
          <label>
            아군 페이즈 (초)
            <input
              type="number"
              min="1"
              step="1"
              :value="stage.allyPhaseSec"
              @change="setStageNumber('allyPhaseSec', $event)"
            >
          </label>
          <label>
            아군 수
            <input
              type="number"
              min="1"
              step="1"
              :value="stage.allyCount"
              @change="setStageNumber('allyCount', $event, true)"
            >
          </label>
          <label>
            아군 간격 (초)
            <input
              type="number"
              min="0.05"
              step="0.05"
              :value="stage.allyInterval"
              @change="setStageNumber('allyInterval', $event)"
            >
          </label>
        </div>
        <div class="burst-head">
          <h3>적 스폰 순서</h3>
          <button
            type="button"
            @click="addBurst"
          >
            버스트 추가
          </button>
        </div>
        <p class="hint">
          같은 버스트는 간격으로 이어 나오고, 버스트가 끝나면 휴식 시간 뒤에 다음 버스트가 시작됩니다.
        </p>
        <div
          v-for="(burst, burstIndex) in stage.bursts"
          :key="burstIndex"
          class="burst"
          :class="{ on: selectedBurst === burstIndex }"
          @click="selectedBurst = burstIndex"
        >
          <header>
            <strong>버스트 {{ burstIndex + 1 }} · {{ burst.units.length }}마리</strong>
            <button
              type="button"
              :disabled="burst.units.length >= MAX_WAVE_SPAWNS_PER_BURST"
              @click.stop="addSpawn(burstIndex)"
            >
              팔레트 적 추가
            </button>
            <button
              type="button"
              class="danger"
              :disabled="stage.bursts.length <= 1"
              @click.stop="removeBurst(burstIndex)"
            >
              버스트 삭제
            </button>
          </header>
          <div class="fields">
            <label>
              간격 (초)
              <input
                type="number"
                min="0.05"
                step="0.05"
                :value="burst.interval"
                @change="setBurstNumber(burstIndex, 'interval', $event)"
              >
            </label>
            <label>
              휴식 (초)
              <input
                type="number"
                min="0"
                step="0.1"
                :value="burst.restAfter"
                @change="setBurstNumber(burstIndex, 'restAfter', $event)"
              >
            </label>
          </div>
          <ol class="spawn-list">
            <li
              v-for="(spawn, spawnIndex) in burst.units"
              :key="`${burstIndex}-${spawnIndex}`"
              class="spawn-row"
              :class="{
                dragging: isDragging(burstIndex, spawnIndex),
                over: isDragOver(burstIndex, spawnIndex),
                missing: !spawnDef(spawn),
              }"
              @dragover="onDragOver(burstIndex, spawnIndex, $event)"
              @drop="onDrop(burstIndex, spawnIndex, $event)"
            >
              <button
                type="button"
                class="handle"
                draggable="true"
                :aria-label="`${spawnIndex + 1}번째 적 순서 변경`"
                @dragstart="onDragStart(burstIndex, spawnIndex, $event)"
                @dragend="onDragEnd"
              >
                ⋮⋮
              </button>
              <span class="spawn-index">{{ spawnIndex + 1 }}</span>
              <span
                class="thumb"
                :class="{ sheet: spawnHasSheet(spawn) }"
                :style="spawnThumbStyle(spawn)"
                aria-hidden="true"
              />
              <span class="spawn-name">{{ spawnLine(spawn) }}</span>
              <button
                type="button"
                class="danger"
                :disabled="burst.units.length <= 1"
                @click="removeSpawn(burstIndex, spawnIndex)"
              >
                삭제
              </button>
            </li>
            <li
              class="spawn-tail"
              :class="{ over: isDragOver(burstIndex, burst.units.length) }"
              @dragover="onDragOver(burstIndex, burst.units.length, $event)"
              @drop="onDrop(burstIndex, burst.units.length, $event)"
            >
              여기로 놓으면 맨 뒤
            </li>
          </ol>
        </div>
      </section>
      <aside class="side-panel">
        <div
          class="tabs"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            :class="{ on: rightTab === 'palette' }"
            :aria-selected="rightTab === 'palette'"
            @click="rightTab = 'palette'"
          >
            팔레트
          </button>
          <button
            type="button"
            role="tab"
            :class="{ on: rightTab === 'json' }"
            :aria-selected="rightTab === 'json'"
            @click="rightTab = 'json'"
          >
            JSON
          </button>
        </div>
        <template v-if="rightTab === 'palette'">
          <div class="json-actions">
            <button
              type="button"
              @click="openEnemies"
            >
              적 고치기
            </button>
          </div>
          <p class="hint">
            클릭하면 고른 버스트에 넣고, 드래그하면 원하는 위치에 끼워 넣습니다.
          </p>
          <div class="palette">
            <button
              v-for="item in catalog"
              :key="item.id"
              type="button"
              class="chip"
              :class="{ on: selectedPalette === item.id }"
              draggable="true"
              @click="addPaletteEnemy(item.id)"
              @dragstart="onPaletteDragStart(item.id, $event)"
              @dragend="onDragEnd"
            >
              <span
                class="thumb"
                :class="{ sheet: hasWalkSheet(item.sprite) }"
                :style="spriteStyle(item.sprite, item.hue)"
                aria-hidden="true"
              />
              <span class="chip-text">
                <strong>{{ item.name }}</strong>
                <span>
                  {{ ENEMY_SPRITE_LABELS[item.sprite] }} · HP {{ item.hp }}
                  <template v-if="item.behavior === 'breaker'"> · {{ ENEMY_BEHAVIOR_LABELS.breaker }}</template>
                  <template v-if="item.hue"> · 색조 {{ item.hue }}</template>
                </span>
              </span>
            </button>
          </div>
        </template>
        <template v-else>
          <div class="json-actions">
            <button
              type="button"
              @click="applyJson"
            >
              JSON 반영
            </button>
            <button
              type="button"
              @click="copyJson"
            >
              JSON 복사
            </button>
            <span
              v-if="copyHint"
              class="copied"
            >{{ copyHint }}</span>
          </div>
          <p class="hint">
            JSON을 직접 고친 뒤에는 반영을 누르세요.
          </p>
          <textarea
            class="json"
            spellcheck="false"
            :value="jsonText"
            @input="onJsonInput"
          />
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 14px 16px 12px;
  overflow: hidden;
  background: #141210;
  color: #f7efe6;
}

.head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-start;
}

.title {
  flex: 1;
  min-width: 220px;
}

.title h1 {
  margin: 0 0 4px;
  font: 700 22px/1.2 "Segoe UI", sans-serif;
}

.title p,
.hint,
.status,
.meta {
  margin: 0;
  color: #d8cfc6;
  font: 600 13px/1.4 "Segoe UI", sans-serif;
}

.hint.gold,
.status {
  color: #e8b060;
}

code {
  font: 600 12px/1.3 ui-monospace, monospace;
  color: #e8b060;
}

.actions,
.stage-tools,
.json-actions,
.tabs,
.burst-head,
.burst header {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.back,
button {
  border: 0;
  border-radius: 6px;
  background: #3a3228;
  color: inherit;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
  cursor: pointer;
}

.back,
.primary {
  padding: 7px 12px;
  background: #e8b060;
  color: #1a1410;
}

.actions button,
.stage-tools button,
.json-actions button,
.tabs button,
.burst-head button,
.burst header button {
  padding: 7px 10px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ghost {
  background: #3a3228;
}

.danger {
  background: #5a3228;
}

.body {
  display: grid;
  grid-template-columns: minmax(180px, 220px) minmax(320px, 1fr) minmax(260px, 0.9fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.stage-list,
.form,
.side-panel {
  min-height: 0;
  padding: 10px;
  border-radius: 8px;
  background: rgba(20, 16, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.2);
}

.stage-list,
.form {
  overflow: auto;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.tabs button.on {
  background: #e8b060;
  color: #1a1410;
}

.stage-list ol {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.stage-list li button {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin: 0 0 6px;
  padding: 8px 10px;
  text-align: left;
}

.stage-list li button.on {
  background: #e8b060;
  color: #1a1410;
}

.stage-list li button.on .meta {
  color: #3a3228;
}

.form h2,
.form h3 {
  margin: 0 0 8px;
  font: 700 16px/1.2 "Segoe UI", sans-serif;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin: 10px 0;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
}

.fields input {
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

.burst {
  margin: 0 0 12px;
  padding: 10px;
  border-radius: 6px;
  background: #1a1613;
}

.burst.on {
  box-shadow: inset 0 0 0 1px #e8b060;
}

.palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.chip {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  text-align: left;
}

.chip-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.chip .thumb,
.spawn-row .thumb {
  display: block;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 4px;
  image-rendering: pixelated;
  background-repeat: no-repeat;
}

.spawn-row .thumb {
  width: 28px;
  height: 28px;
}

.chip .thumb.sheet,
.spawn-row .thumb.sheet {
  background-size: 600% 100%;
  background-position: 0 0;
}

.chip.on {
  background: #e8b060;
  color: #1a1410;
}

.chip span {
  color: #d8cfc6;
  font: 600 11px/1.2 "Segoe UI", sans-serif;
}

.chip.on span {
  color: #3a3228;
}

.burst-head {
  justify-content: space-between;
  margin: 12px 0 8px;
}

.spawn-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.spawn-row,
.spawn-tail {
  display: grid;
  grid-template-columns: 28px 28px 28px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  margin: 0 0 4px;
  padding: 4px 6px;
  border-radius: 4px;
  background: #141210;
}

.spawn-row.missing {
  box-shadow: inset 0 0 0 1px #c45c48;
}

.spawn-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 700 12px/1.3 "Segoe UI", sans-serif;
}

.spawn-row.dragging {
  opacity: 0.45;
}

.spawn-row.over,
.spawn-tail.over {
  box-shadow: inset 0 2px 0 #e8b060;
}

.spawn-tail {
  grid-template-columns: 1fr;
  min-height: 28px;
  color: #8a8478;
  font: 600 11px/1.2 "Segoe UI", sans-serif;
}

.handle {
  width: 28px;
  height: 28px;
  padding: 0;
  cursor: grab;
  color: #e8b060;
}

.handle:active {
  cursor: grabbing;
}

.spawn-index {
  font: 700 12px/1 "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.spawn-row select,
.spawn-row .hp input {
  box-sizing: border-box;
  width: 100%;
  padding: 5px 6px;
  border: 0;
  border-radius: 4px;
  background: #1a1412;
  color: #f7efe6;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
}

.spawn-row .hp {
  display: flex;
  gap: 4px;
  align-items: center;
  font: 700 11px/1 "Segoe UI", sans-serif;
}

.json {
  box-sizing: border-box;
  flex: 1;
  min-height: 240px;
  width: 100%;
  margin: 0;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: #1a1412;
  color: #d8cfc6;
  font: 600 11px/1.35 ui-monospace, monospace;
  resize: none;
}

.copied {
  color: #8fd08a;
  font: 700 12px/1 "Segoe UI", sans-serif;
}

@media (max-width: 980px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
