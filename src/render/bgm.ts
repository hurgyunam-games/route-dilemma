import type { MapId } from "@/core";
import {
  getAudioSettings,
  mixChannelVolume,
  subscribeAudioSettings,
} from "./audio-settings";
import { WORLD_BGM_FILE, battleBgmFile } from "./bgm-tracks";

const bgmUrls = import.meta.glob("./assets/bgm-*.ogg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const elements = new Map<string, HTMLAudioElement>();
let wanted: string | null = null;

function trackUrl(file: string): string | undefined {
  return bgmUrls[`./assets/${file}`];
}

function ensure(file: string): HTMLAudioElement | null {
  const existing = elements.get(file);
  if (existing) {
    return existing;
  }
  if (typeof Audio === "undefined") {
    return null;
  }
  const url = trackUrl(file);
  if (!url) {
    return null;
  }
  const element = new Audio(url);
  element.loop = true;
  element.preload = "auto";
  elements.set(file, element);
  return element;
}

function pauseOthers(keep: string): void {
  for (const [file, element] of elements) {
    if (file === keep) {
      continue;
    }
    element.pause();
    if (file !== WORLD_BGM_FILE) {
      element.currentTime = 0;
    }
  }
}

function applyVolume(): void {
  const level = mixChannelVolume(getAudioSettings(), "bgm");
  for (const [file, element] of elements) {
    element.volume = level;
    if (file !== wanted) {
      continue;
    }
    if (level <= 0) {
      element.pause();
      continue;
    }
    if (!element.paused) {
      continue;
    }
    void element.play().then(() => {
      if (wanted !== file || element.volume <= 0) {
        element.pause();
      }
    }).catch(() => {
      /* autoplay can be blocked until a click */
    });
  }
}

function playWanted(rewind: boolean): void {
  if (!wanted) {
    return;
  }
  pauseOthers(wanted);
  const element = ensure(wanted);
  if (!element) {
    return;
  }
  if (rewind && wanted !== WORLD_BGM_FILE) {
    element.currentTime = 0;
  }
  applyVolume();
}

subscribeAudioSettings(() => {
  applyVolume();
});

/** Loop Port Town. A second call keeps the current position. */
export function startWorldBgm(): void {
  wanted = WORLD_BGM_FILE;
  playWanted(false);
}

/** Loop the track for this map. A second call for the same track does not restart it. */
export function startBattleBgm(mapId: MapId): void {
  const file = battleBgmFile(mapId);
  const rewind = wanted !== file;
  wanted = file;
  playWanted(rewind);
}

/** Leave the battle loop and return to the world map track. */
export function stopBattleBgm(): void {
  startWorldBgm();
}

/** Retry the current track after a gesture, without switching tracks. */
export function resumeBgm(): void {
  playWanted(false);
}
