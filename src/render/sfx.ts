export type CombatSfxCue = "leak" | "reward" | "collapse" | "allyLost";

const sfxUrls = import.meta.glob("./assets/sfx-*.wav", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const FILES: Record<CombatSfxCue, string> = {
  leak: "sfx-leak.wav",
  reward: "sfx-reward.wav",
  collapse: "sfx-collapse.wav",
  allyLost: "sfx-ally-lost.wav",
};

const voices = new Map<CombatSfxCue, HTMLAudioElement>();

function sfxUrl(cue: CombatSfxCue): string | undefined {
  return sfxUrls[`./assets/${FILES[cue]}`];
}

function voice(cue: CombatSfxCue): HTMLAudioElement | null {
  if (typeof Audio === "undefined") {
    return null;
  }
  const existing = voices.get(cue);
  if (existing) {
    return existing;
  }
  const url = sfxUrl(cue);
  if (!url) {
    return null;
  }
  const audio = new Audio(url);
  audio.preload = "auto";
  voices.set(cue, audio);
  return audio;
}

/** Restart the same element instead of stacking new ones. */
export function playCombatSfx(cue: CombatSfxCue): void {
  const audio = voice(cue);
  if (!audio) {
    return;
  }
  audio.currentTime = 0;
  void audio.play().catch(() => {
    /* autoplay can be blocked until a click; ignore */
  });
}

export function unlockCombatSfx(): void {
  for (const cue of Object.keys(FILES) as CombatSfxCue[]) {
    const audio = voice(cue);
    if (!audio) {
      continue;
    }
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }
}
