export const SOUND_MUTE_KEY = "rsm_sound_muted";
export const SOUND_VOLUME_KEY = "rsm_sound_volume";
export const SOUND_PRESET_KEY = "rsm_sound_preset";

export const SOUND_PRESETS = [
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "pop", label: "Pop" },
  { id: "soft", label: "Soft" },
] as const;

export type SoundPresetId = (typeof SOUND_PRESETS)[number]["id"];

let audioCtx: AudioContext | null = null;

function AudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

export function readSoundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
}

/** 0–100. Mute does not change this value. */
export function readSoundVolume(): number {
  try {
    const raw = localStorage.getItem(SOUND_VOLUME_KEY);
    if (raw === null) return 80;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 80;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    return 80;
  }
}

export function persistSoundVolume(volume: number): void {
  try {
    localStorage.setItem(SOUND_VOLUME_KEY, String(Math.min(100, Math.max(0, Math.round(volume)))));
  } catch {
    /* private mode */
  }
}

export function readSoundPreset(): SoundPresetId {
  try {
    const raw = localStorage.getItem(SOUND_PRESET_KEY);
    if (SOUND_PRESETS.some((p) => p.id === raw)) return raw as SoundPresetId;
  } catch {
    /* private mode */
  }
  return "chime";
}

export function persistSoundPreset(id: SoundPresetId): void {
  try {
    localStorage.setItem(SOUND_PRESET_KEY, id);
  } catch {
    /* private mode */
  }
}

export function unlockAudio(): void {
  const Ctor = AudioContextCtor();
  if (!Ctor) return;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function peakGain(): number {
  return (readSoundVolume() / 100) * 0.1;
}

type Tone = { freq: number; start: number; duration: number; type?: OscillatorType };

function playTones(tones: Tone[], peak: number): void {
  if (peak <= 0) return;
  unlockAudio();
  if (!audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0.0001, now + t.start);
    gain.gain.exponentialRampToValueAtTime(peak, now + t.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration);
  }
}

function tonesForPreset(id: SoundPresetId): Tone[] {
  switch (id) {
    case "bell":
      return [
        { freq: 784.0, start: 0, duration: 0.28, type: "triangle" },
        { freq: 1174.7, start: 0.08, duration: 0.32, type: "triangle" },
      ];
    case "pop":
      return [
        { freq: 180, start: 0, duration: 0.07, type: "square" },
        { freq: 420, start: 0.05, duration: 0.08, type: "square" },
      ];
    case "soft":
      return [
        { freq: 349.23, start: 0, duration: 0.28, type: "sine" },
        { freq: 440.0, start: 0.14, duration: 0.32, type: "sine" },
      ];
    case "chime":
    default:
      return [
        { freq: 523.25, start: 0, duration: 0.18, type: "sine" },
        { freq: 659.25, start: 0.12, duration: 0.22, type: "sine" },
      ];
  }
}

/** Reveal sound using the saved preset and volume. Mute silences it; volume is unchanged. */
export function playRevealChime(): void {
  if (typeof window === "undefined") return;
  if (readSoundMuted()) return;
  try {
    playTones(tonesForPreset(readSoundPreset()), peakGain());
  } catch {
    /* autoplay policy / unsupported */
  }
}

/** Preview a preset at the saved volume, even if muted, so the lecturer can audition. */
export function previewSound(id: SoundPresetId): void {
  if (typeof window === "undefined") return;
  try {
    playTones(tonesForPreset(id), peakGain() || 0.06);
  } catch {
    /* autoplay policy / unsupported */
  }
}

export function playTimerCue(): void {
  if (typeof window === "undefined") return;
  if (readSoundMuted()) return;
  try {
    playTones(
      [
        { freq: 392.0, start: 0, duration: 0.22, type: "triangle" },
        { freq: 329.63, start: 0.2, duration: 0.35, type: "triangle" },
      ],
      peakGain() * 0.85,
    );
  } catch {
    /* autoplay policy / unsupported */
  }
}
