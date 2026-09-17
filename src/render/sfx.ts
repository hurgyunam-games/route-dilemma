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

/** Skip retriggering the same cue so 2x/3x leaks do not stack into noise. */
const COOLDOWN_MS: Record<CombatSfxCue, number> = {
  leak: 320,
  reward: 280,
  collapse: 300,
  allyLost: 320,
};

type SynthNote = {
  readonly freq: number;
  readonly type: OscillatorType;
  readonly at: number;
  readonly dur: number;
  readonly gain: number;
};

const SYNTH: Record<CombatSfxCue, readonly SynthNote[]> = {
  leak: [
    { freq: 784, type: "square", at: 0, dur: 0.09, gain: 0.05 },
    { freq: 494, type: "square", at: 0.1, dur: 0.14, gain: 0.045 },
  ],
  reward: [
    { freq: 659, type: "sine", at: 0, dur: 0.08, gain: 0.06 },
    { freq: 784, type: "sine", at: 0.07, dur: 0.08, gain: 0.055 },
    { freq: 1047, type: "sine", at: 0.14, dur: 0.12, gain: 0.05 },
  ],
  collapse: [
    { freq: 110, type: "sawtooth", at: 0, dur: 0.12, gain: 0.06 },
    { freq: 70, type: "sawtooth", at: 0.08, dur: 0.16, gain: 0.05 },
  ],
  allyLost: [
    { freq: 392, type: "triangle", at: 0, dur: 0.12, gain: 0.05 },
    { freq: 311, type: "triangle", at: 0.1, dur: 0.16, gain: 0.045 },
  ],
};

const voices = new Map<CombatSfxCue, HTMLAudioElement>();
const lastPlayed = new Map<CombatSfxCue, number>();
let audioCtx: AudioContext | null = null;

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

function getAudioContext(): AudioContext | null {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function playSynth(cue: CombatSfxCue): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }
  void ctx.resume().catch(() => {
    /* autoplay can be blocked until a click; ignore */
  });
  const now = ctx.currentTime;
  for (const note of SYNTH[cue]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, now + note.at);
    const start = now + note.at;
    const end = start + note.dur;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

function playVoice(cue: CombatSfxCue): void {
  const audio = voice(cue);
  if (!audio) {
    playSynth(cue);
    return;
  }
  audio.currentTime = 0;
  void audio.play().catch(() => {
    playSynth(cue);
  });
}

/** Restart the same element instead of stacking new ones. */
export function playCombatSfx(cue: CombatSfxCue, now = performance.now()): void {
  const last = lastPlayed.get(cue) ?? Number.NEGATIVE_INFINITY;
  if (now - last < COOLDOWN_MS[cue]) {
    return;
  }
  lastPlayed.set(cue, now);
  playVoice(cue);
}

export function unlockCombatSfx(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      /* wait for a later click */
    });
  }
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
