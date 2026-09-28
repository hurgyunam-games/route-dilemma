export const AUDIO_STORAGE_KEY = "route-dilemma.audio";

export type AudioChannel = "master" | "sfx" | "bgm";

export type AudioSettings = {
  readonly master: number;
  readonly sfx: number;
  readonly bgm: number;
};

export type AudioStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  sfx: 1,
  bgm: 1,
};

export function clampAudioUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

export function mixChannelVolume(settings: AudioSettings, channel: "sfx" | "bgm"): number {
  return clampAudioUnit(settings.master, 0) * clampAudioUnit(settings[channel], 0);
}

export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  try {
    const data = JSON.parse(raw) as Partial<Record<AudioChannel, unknown>>;
    return {
      master: clampAudioUnit(data.master, DEFAULT_AUDIO_SETTINGS.master),
      sfx: clampAudioUnit(data.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
      bgm: clampAudioUnit(data.bgm, DEFAULT_AUDIO_SETTINGS.bgm),
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function loadAudioSettings(store: AudioStore | null): AudioSettings {
  if (!store) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  try {
    return parseAudioSettings(store.getItem(AUDIO_STORAGE_KEY));
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(store: AudioStore | null, settings: AudioSettings): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage may be blocked */
  }
}

type Listener = (settings: AudioSettings) => void;

let current: AudioSettings | null = null;
const listeners = new Set<Listener>();

function browserStore(): AudioStore | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

export function getAudioSettings(): AudioSettings {
  if (!current) {
    current = loadAudioSettings(browserStore());
  }
  return current;
}

export function setAudioChannel(channel: AudioChannel, value: number): AudioSettings {
  const prev = getAudioSettings();
  const next: AudioSettings = {
    ...prev,
    [channel]: clampAudioUnit(value, prev[channel]),
  };
  current = next;
  saveAudioSettings(browserStore(), next);
  for (const listener of listeners) {
    listener(next);
  }
  return next;
}

export function subscribeAudioSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
