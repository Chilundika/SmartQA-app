export const SOUND_MUTE_KEY = "rsm_sound_muted";

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

/** Call from a user gesture (Begin Match / Reshuffle) so the later reveal chime is allowed. */
export function unlockAudio(): void {
  const Ctor = AudioContextCtor();
  if (!Ctor) return;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

/** Short two-note chime after a match reveal settles. No audio file required. */
export function playRevealChime(): void {
  if (typeof window === "undefined") return;
  if (readSoundMuted()) return;

  try {
    unlockAudio();
    if (!audioCtx) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;

    function tone(freq: number, start: number, duration: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.08, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    }

    tone(523.25, 0, 0.18);
    tone(659.25, 0.12, 0.22);
  } catch {
    /* autoplay policy / unsupported */
  }
}

/** Softer two-note cue when the per-question countdown hits zero. Respects the mute toggle. */
export function playTimerCue(): void {
  if (typeof window === "undefined") return;
  if (readSoundMuted()) return;

  try {
    unlockAudio();
    if (!audioCtx) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;

    function tone(freq: number, start: number, duration: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.07, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    }

    tone(392.0, 0, 0.22);
    tone(329.63, 0.2, 0.35);
  } catch {
    /* autoplay policy / unsupported */
  }
}
