"use client";

import { useState } from "react";
import {
  persistSoundMuted,
  persistSoundPreset,
  persistSoundVolume,
  previewSound,
  readSoundMuted,
  readSoundPreset,
  readSoundVolume,
  SOUND_PRESETS,
} from "@/lib/sound";
import { useMounted } from "@/lib/useMounted";

export default function SoundToggle() {
  const mounted = useMounted();
  const [, setRev] = useState(0);
  const [open, setOpen] = useState(false);
  const muted = mounted ? readSoundMuted() : false;
  const volume = mounted ? readSoundVolume() : 80;
  const preset = mounted ? readSoundPreset() : "chime";

  function refresh() {
    setRev((n) => n + 1);
  }

  return (
    <div className="relative print:hidden">
      <button
        type="button"
        title={muted ? "Unmute reveal sound" : "Sound settings"}
        aria-pressed={muted}
        aria-expanded={open}
        aria-label={muted ? "Sound off" : "Sound settings"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
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

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sound</p>
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => {
                persistSoundMuted(!readSoundMuted());
                refresh();
              }}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                muted ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-800"
              }`}
            >
              {muted ? "Muted" : "Mute"}
            </button>
          </div>

          <label className="block text-xs font-medium text-zinc-700">
            Volume {volume}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => {
                persistSoundVolume(Number(e.target.value));
                refresh();
              }}
              className="mt-1 w-full"
            />
          </label>
          <p className="mb-3 mt-1 text-[11px] text-zinc-500">Mute does not change this level.</p>

          <p className="mb-1.5 text-xs font-medium text-zinc-700">Reveal sound</p>
          <ul className="space-y-1">
            {SOUND_PRESETS.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="sound-preset"
                    checked={preset === p.id}
                    onChange={() => {
                      persistSoundPreset(p.id);
                      refresh();
                    }}
                  />
                  {p.label}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    persistSoundPreset(p.id);
                    refresh();
                    previewSound(p.id);
                  }}
                  className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
                >
                  Preview
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
