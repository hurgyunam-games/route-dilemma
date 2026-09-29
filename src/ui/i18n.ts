/** UI language. Simulation stays in core; this module only picks sentences. */

import { ref } from "vue";
import { en, type MessageKey } from "@/ui/locales/en";
import { ko } from "@/ui/locales/ko";

export type { MessageKey };
export type LocaleId = "en" | "ko";

const STORAGE_KEY = "route-dilemma.locale";
const catalogs: Record<LocaleId, Record<MessageKey, string>> = { en, ko };

export const locale = ref<LocaleId>("en");

type Params = Record<string, string | number>;

const DEFAULT_SAVE_NAME = /^세이브 (\d+)$/;
const GOLD_SHORT = /^골드가 부족합니다 \(필요 ([^,]+), 보유 ([^)]+)\)$/;

const COMMAND_REASONS: Record<string, MessageKey> = {
  "타워가 없습니다": "reason.noTower",
  "여기에 지을 수 없습니다": "reason.cantBuild",
  "이미 타워가 있습니다": "reason.occupied",
  "연구로 해금해야 지을 수 있습니다": "reason.locked",
  "아직 건설 중입니다": "reason.building",
  "최대 레벨입니다": "reason.maxLevel",
  "업그레이드할 수 없습니다": "reason.cantUpgrade",
};

function fill(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] === undefined ? "" : String(params[name]),
  );
}

export function pickLocale(stored: string | null, language: string): LocaleId {
  if (stored === "en" || stored === "ko") {
    return stored;
  }
  return language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function applyDocumentLang(): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale.value;
  }
}

export function initLocale(): void {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const language = typeof navigator !== "undefined" ? navigator.language : "en";
  locale.value = pickLocale(stored, language);
  applyDocumentLang();
}

export function setLocale(next: LocaleId): void {
  locale.value = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next);
  }
  applyDocumentLang();
}

export function t(key: MessageKey, params?: Params): string {
  return fill(catalogs[locale.value][key], params);
}

/** Named game content. Unknown ids keep the core string. */
export function content(key: string, fallback: string): string {
  const table = catalogs[locale.value] as Record<string, string>;
  const template = table[key] ?? (catalogs.en as Record<string, string>)[key];
  return template ? fill(template) : fallback;
}

export function mapTitle(id: number): string {
  return content(`map.${id}.name`, String(id));
}

export function towerTitle(id: string): string {
  return content(`tower.${id}.name`, id);
}

export function researchTitle(id: string): string {
  return content(`research.${id}.name`, id);
}

export function researchBody(id: string): string {
  return content(`research.${id}.description`, "");
}

export function attackRole(id: string): string {
  return content(`attack.${id}`, id);
}

export function behaviorLabel(id: string): string {
  return content(`behavior.${id}`, id);
}

export function warningTitle(behavior: string): string {
  return content(`warning.${behavior}.title`, "");
}

export function warningMessage(behavior: string): string {
  return content(`warning.${behavior}.message`, "");
}

/** Default slot names stay stored as `세이브 N` and are translated only on screen. */
export function saveSlotTitle(name: string): string {
  const match = DEFAULT_SAVE_NAME.exec(name);
  if (!match?.[1]) {
    return name;
  }
  return t("save.defaultName", { n: match[1] });
}

export function translateCommandReason(reason: string): string {
  const gold = GOLD_SHORT.exec(reason);
  if (gold?.[1] && gold[2]) {
    return t("reason.goldShort", { need: gold[1].trim(), have: gold[2].trim() });
  }
  const key = COMMAND_REASONS[reason];
  return key ? t(key) : reason;
}

export function formatSavedAt(ms: number): string {
  if (!(ms > 0)) {
    return "";
  }
  const tag = locale.value === "ko" ? "ko-KR" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
}
