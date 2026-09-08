"use client";

import { useState } from "react";
import { persistSoundMuted, playRevealChime, readSoundMuted } from "@/lib/sound";
import { useMounted } from "@/lib/useMounted";

export default function SoundToggle() {
  const mounted = useMounted();
  const [, setRev] = useState(0);
  const muted = mounted ? readSoundMuted() : false;

  return (
    <button
      type="button"
      title={muted ? "Unmute reveal sound" : "Mute reveal sound"}
      aria-pressed={muted}
      aria-label={muted ? "Sound off" : "Sound on"}
      onClick={() => {
        const next = !readSoundMuted();
        persistSoundMuted(next);
        setRev((n) => n + 1);
        if (!next) playRevealChime();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      {muted ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="m22 9-6 6M16 9l6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      )}
    </button>
  );
}
