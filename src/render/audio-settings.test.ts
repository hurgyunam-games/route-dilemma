import { describe, expect, it } from "vitest";
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  clampAudioUnit,
  loadAudioSettings,
  mixChannelVolume,
  parseAudioSettings,
  saveAudioSettings,
  type AudioStore,
} from "./audio-settings";

function memoryStore(): AudioStore & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("audio settings", () => {
  it("starts at full volume when nothing is stored", () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(memoryStore())).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("clamps each channel into 0–1 and keeps missing fields", () => {
    expect(clampAudioUnit(1.8, 1)).toBe(1);
    expect(clampAudioUnit(-0.2, 1)).toBe(0);
    expect(clampAudioUnit("loud", 0.4)).toBe(0.4);
    expect(parseAudioSettings(JSON.stringify({ master: 2, sfx: -1 }))).toEqual({
      master: 1,
      sfx: 0,
      bgm: 1,
    });
  });

  it("ignores invalid json", () => {
    expect(parseAudioSettings("{")).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("multiplies master into the sfx and bgm channels", () => {
    const settings = { master: 0.5, sfx: 0.4, bgm: 0.8 };
    expect(mixChannelVolume(settings, "sfx")).toBe(0.2);
    expect(mixChannelVolume(settings, "bgm")).toBe(0.4);
    expect(mixChannelVolume({ ...settings, master: 0 }, "bgm")).toBe(0);
  });

  it("round-trips through storage", () => {
    const store = memoryStore();
    const settings = { master: 0.7, sfx: 0.3, bgm: 0 };
    saveAudioSettings(store, settings);
    expect(store.data.get(AUDIO_STORAGE_KEY)).toBe(JSON.stringify(settings));
    expect(loadAudioSettings(store)).toEqual(settings);
  });
});
