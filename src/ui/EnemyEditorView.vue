<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import {
  ENEMY_SPRITE_LABELS,
  ENEMY_TYPE_IDS,
  MAX_ENEMIES,
  MIN_ENEMIES,
  bundledEnemyTable,
  cloneEnemyTable,
  defaultEnemy,
  getEnemyTable,
  nextEnemyId,
  normalizeHue,
  parseEnemyTableJson,
  resetEnemyTable,
  serializeEnemyTable,
  setEnemyTable,
  shiftHue,
  waveEnemyIds,
  type EnemyDef,
  type EnemyTable,
  type EnemyTypeId,
} from "@/core";
import { enemyWalkPreview } from "@/render/enemy-sprites";

const emit = defineEmits<{
  leave: [];
}>();

const draft = ref<EnemyTable>(cloneEnemyTable(getEnemyTable()));
const selected = ref(0);
const jsonText = ref(serializeEnemyTable(draft.value));
const jsonDirty = ref(false);
const status = ref("");
const copyHint = ref("");
const usedIds = ref(new Set(waveEnemyIds()));

watch(
  draft,
  (table) => {
    if (!jsonDirty.value) {
      jsonText.value = serializeEnemyTable(table);
    }
  },
  { deep: true },
);

const enemy = computed(() => draft.value.enemies[selected.value] ?? null);
const canAdd = computed(() => draft.value.enemies.length < MAX_ENEMIES);
const canRemove = computed(() => draft.value.enemies.length > MIN_ENEMIES);
const used = computed(() => (enemy.value ? usedIds.value.has(enemy.value.id) : false));

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

const setStatus = (text: string): void => {
  status.value = text;
};

const replaceEnemies = (enemies: readonly EnemyDef[], nextSelected = selected.value): void => {
  draft.value = { enemies };
  selected.value = Math.max(0, Math.min(nextSelected, enemies.length - 1));
};

const updateEnemy = (patch: Partial<EnemyDef>): void => {
  const current = enemy.value;
  if (!current) {
    return;
  }
  replaceEnemies(
    draft.value.enemies.map((row, index) => (index === selected.value ? { ...row, ...patch } : row)),
  );
};

const readNumber = (event: Event): number | null => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return null;
  }
  const value = Number(target.value);
  return Number.isFinite(value) ? value : null;
};

const setName = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  updateEnemy({ name: target.value });
};

const setId = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  updateEnemy({ id: target.value.trim().toLowerCase() });
};

const setHp = (event: Event): void => {
  const value = readNumber(event);
  if (value === null) {
    return;
  }
  updateEnemy({ hp: Math.max(1, Math.round(value)) });
};

const setSprite = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }
  if (!(ENEMY_TYPE_IDS as readonly string[]).includes(target.value)) {
    return;
  }
  updateEnemy({ sprite: target.value as EnemyTypeId });
};

const setHue = (event: Event): void => {
  const value = readNumber(event);
  if (value === null) {
    return;
  }
  updateEnemy({ hue: normalizeHue(value) });
};

const addEnemy = (): void => {
  if (!canAdd.value) {
    return;
  }
  const ids = draft.value.enemies.map((row) => row.id);
  const from = enemy.value ?? draft.value.enemies[draft.value.enemies.length - 1];
  const sprite = from?.sprite ?? "slime";
  const hp = from?.hp ?? 10;
  const id = nextEnemyId(sprite, hp, ids);
  const next = defaultEnemy(id, from);
  replaceEnemies(
    [
      ...draft.value.enemies,
      {
        ...next,
        hue: shiftHue(from?.hue ?? 0),
        name: `${ENEMY_SPRITE_LABELS[sprite]} ${hp}`,
      },
    ],
    draft.value.enemies.length,
  );
};

const duplicateEnemy = (): void => {
  if (!canAdd.value || !enemy.value) {
    return;
  }
  const ids = draft.value.enemies.map((row) => row.id);
  const id = nextEnemyId(enemy.value.sprite, enemy.value.hp, ids);
  const insertAt = selected.value + 1;
  const enemies = [
    ...draft.value.enemies.slice(0, insertAt),
    { ...enemy.value, id, name: `${enemy.value.name} 복사`, hue: shiftHue(enemy.value.hue) },
    ...draft.value.enemies.slice(insertAt),
  ];
  replaceEnemies(enemies, insertAt);
};

const removeEnemy = (): void => {
  if (!canRemove.value || !enemy.value) {
    return;
  }
  if (usedIds.value.has(enemy.value.id)) {
    setStatus("웨이브가 쓰는 적은 삭제할 수 없습니다");
    return;
  }
  replaceEnemies(
    draft.value.enemies.filter((_, index) => index !== selected.value),
    Math.min(selected.value, draft.value.enemies.length - 2),
  );
};

const applyJson = (): void => {
  const parsed = parseEnemyTableJson(jsonText.value);
  if (!parsed.ok) {
    setStatus(parsed.reason);
    return;
  }
  jsonDirty.value = false;
  replaceEnemies(parsed.table.enemies, selected.value);
  jsonText.value = serializeEnemyTable(parsed.table);
  setStatus("JSON을 폼에 반영했습니다");
};

const applySession = (): string | null => {
  const parsed = parseEnemyTableJson(serializeEnemyTable(draft.value));
  if (!parsed.ok) {
    setStatus(parsed.reason);
    return null;
  }
  setEnemyTable(parsed.table);
  jsonDirty.value = false;
  replaceEnemies(parsed.table.enemies, selected.value);
  jsonText.value = serializeEnemyTable(parsed.table);
  usedIds.value = new Set(waveEnemyIds());
  return serializeEnemyTable(parsed.table);
};

const applyToBattle = (): void => {
  if (applySession()) {
    setStatus("세션에 적용했습니다. 웨이브는 이 목록을 팔레트로 씁니다.");
  }
};

const saveFile = async (): Promise<void> => {
  const body = applySession();
  if (!body) {
    return;
  }
  try {
    const res = await fetch("/__enemy-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const detail = await res.text();
      setStatus(`세션에 적용됨 · 파일 저장 실패${detail ? `: ${detail}` : ""}`);
      return;
    }
    setStatus("src/core/enemies.json에 저장했습니다");
  } catch {
    setStatus("세션에 적용됨 · 파일 저장은 개발 서버에서만 됩니다");
  }
};

const copyJson = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(serializeEnemyTable(draft.value));
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
  replaceEnemies(bundledEnemyTable().enemies, selected.value);
  resetEnemyTable();
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

const openWaves = (): void => {
  window.location.hash = "waves";
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
        <h1>적 에디터</h1>
        <p>
          이름·스프라이트·HP를 가진 적 목록을 만듭니다. 웨이브 에디터는 이 목록을 팔레트로 씁니다.
        </p>
      </div>
      <div class="actions">
        <button
          type="button"
          @click="openWaves"
        >
          웨이브 에디터
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
      <aside class="list">
        <div class="tools">
          <button
            type="button"
            :disabled="!canAdd"
            @click="addEnemy"
          >
            적 추가
          </button>
          <button
            type="button"
            :disabled="!canAdd"
            @click="duplicateEnemy"
          >
            복제
          </button>
          <button
            type="button"
            class="danger"
            :disabled="!canRemove || used"
            @click="removeEnemy"
          >
            삭제
          </button>
        </div>
        <ol>
          <li
            v-for="(row, index) in draft.enemies"
            :key="row.id"
          >
            <button
              type="button"
              :class="{ on: index === selected }"
              @click="selected = index"
            >
              <span
                class="thumb"
                :class="{ sheet: hasWalkSheet(row.sprite) }"
                :style="spriteStyle(row.sprite, row.hue)"
                aria-hidden="true"
              />
              <span class="row-text">
                <span>{{ row.name }}</span>
                <span class="meta">
                  {{ ENEMY_SPRITE_LABELS[row.sprite] }} · HP {{ row.hp }}
                  <template v-if="row.hue"> · 색조 {{ row.hue }}</template>
                  <template v-if="usedIds.has(row.id)"> · 사용중</template>
                </span>
              </span>
            </button>
          </li>
        </ol>
      </aside>
      <section
        v-if="enemy"
        class="form"
      >
        <h2>{{ enemy.name }}</h2>
        <div class="preview-block">
          <div
            class="preview"
            :class="{ sheet: hasWalkSheet(enemy.sprite) }"
            :style="spriteStyle(enemy.sprite, enemy.hue)"
            :aria-label="`${ENEMY_SPRITE_LABELS[enemy.sprite]} 이미지`"
          />
          <p class="hint">
            {{ ENEMY_SPRITE_LABELS[enemy.sprite] }}
            <template v-if="enemy.hue"> · 색조 {{ enemy.hue }}°</template>
            <template v-if="!hasWalkSheet(enemy.sprite)">
              · 시트 없음, 색 칸
            </template>
          </p>
        </div>
        <p
          v-if="used"
          class="hint gold"
        >
          웨이브가 이 id를 참조합니다. id를 바꾸면 웨이브가 깨질 수 있습니다.
        </p>
        <div class="fields">
          <label>
            id
            <input
              :value="enemy.id"
              spellcheck="false"
              @change="setId"
            >
          </label>
          <label>
            이름
            <input
              :value="enemy.name"
              @change="setName"
            >
          </label>
          <label>
            스프라이트
            <select
              :value="enemy.sprite"
              @change="setSprite"
            >
              <option
                v-for="sprite in ENEMY_TYPE_IDS"
                :key="sprite"
                :value="sprite"
              >
                {{ ENEMY_SPRITE_LABELS[sprite] }}
              </option>
            </select>
          </label>
          <label>
            HP
            <input
              type="number"
              min="1"
              step="1"
              :value="enemy.hp"
              @change="setHp"
            >
          </label>
          <label class="hue-field">
            색조
            <span class="hue-row">
              <input
                type="range"
                min="0"
                max="359"
                :value="enemy.hue"
                @input="setHue"
              >
              <input
                type="number"
                min="0"
                max="359"
                :value="enemy.hue"
                @change="setHue"
              >
            </span>
          </label>
        </div>
      </section>
      <aside class="json-panel">
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
        <textarea
          class="json"
          spellcheck="false"
          :value="jsonText"
          @input="onJsonInput"
        />
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

.actions,
.tools,
.json-actions {
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
.tools button,
.json-actions button {
  padding: 7px 10px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.danger {
  background: #5a3228;
}

.body {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(280px, 1fr) minmax(240px, 0.8fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.list,
.form,
.json-panel {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  border-radius: 8px;
  background: rgba(20, 16, 14, 0.96);
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.2);
}

.list ol {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.list li button {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 8px;
  align-items: center;
  width: 100%;
  margin: 0 0 6px;
  padding: 6px 8px;
  text-align: left;
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.thumb,
.preview {
  display: block;
  flex-shrink: 0;
  overflow: hidden;
  image-rendering: pixelated;
  background-repeat: no-repeat;
}

.thumb {
  width: 44px;
  height: 44px;
  border-radius: 4px;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  margin: 0 0 12px;
}

.preview {
  width: 96px;
  height: 96px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(232, 176, 96, 0.35);
}

.thumb.sheet,
.preview.sheet {
  background-size: 600% 100%;
  background-position: 0 0;
}

.preview.sheet {
  animation: enemy-walk 0.72s steps(6) infinite;
}

@keyframes enemy-walk {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 100% 0;
  }
}

.list li button.on {
  background: #e8b060;
  color: #1a1410;
}

.list li button.on .meta {
  color: #3a3228;
}

.form h2 {
  margin: 0 0 8px;
  font: 700 16px/1.2 "Segoe UI", sans-serif;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
  margin: 10px 0;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font: 700 12px/1.2 "Segoe UI", sans-serif;
}

.fields input,
.fields select {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: #1a1412;
  color: #f7efe6;
  font: 700 14px/1.2 "Segoe UI", sans-serif;
}

.hue-field {
  grid-column: 1 / -1;
}

.hue-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 8px;
  align-items: center;
}

.hue-row input[type="range"] {
  padding: 0;
  height: 22px;
  accent-color: #e8b060;
}

.json-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
