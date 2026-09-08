"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown } from "@/lib/countdown";
import { playTimerCue } from "@/lib/sound";

type Props = {
  durationSeconds: number;
  /** True once the shuffle has settled and a match is on screen. */
  active: boolean;
  /** Bumped on Begin Match / Reshuffle so a new question gets a fresh clock. */
  resetKey: string;
  /** Pause Session freezes the remaining time without resetting it. */
  frozen?: boolean;
};

export default function QuestionCountdown({ durationSeconds, active, resetKey, frozen = false }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [expired, setExpired] = useState(false);
  const remainingRef = useRef(durationSeconds);
  const cuePlayedRef = useRef(false);

  useEffect(() => {
    remainingRef.current = durationSeconds;
    setRemaining(durationSeconds);
    setExpired(false);
    cuePlayedRef.current = false;
  }, [active, durationSeconds, resetKey]);

  useEffect(() => {
    if (!active || durationSeconds <= 0 || frozen) return;

    const endsAt = Date.now() + remainingRef.current * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      remainingRef.current = left;
      setRemaining(left);
      if (left === 0) {
        setExpired(true);
        window.clearInterval(id);
        if (!cuePlayedRef.current) {
          cuePlayedRef.current = true;
          playTimerCue();
        }
      }
    }, 200);

    return () => window.clearInterval(id);
  }, [active, durationSeconds, resetKey, frozen]);

  if (durationSeconds <= 0 || !active) return null;

  const urgent = remaining > 0 && remaining <= 15;

  return (
    <div
      role="timer"
      aria-live={expired ? "assertive" : "polite"}
      aria-label={expired ? "Time is up" : `${formatCountdown(remaining)} remaining`}
      className={`rounded-lg border px-3 py-2 sm:px-4 sm:py-3 projector:px-6 projector:py-5 ${
        expired
          ? "animate-timer-pulse border-amber-400 bg-amber-50 text-amber-950"
          : urgent
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-zinc-200 bg-white text-zinc-900"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 projector:text-sm">
        {expired ? "Time is up" : "Time remaining"}
      </p>
      <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl projector:text-6xl">
        {formatCountdown(remaining)}
      </p>
      {expired && (
        <p className="mt-1 text-sm text-amber-900 projector:text-xl">
          Mark complete or skip when you are ready — the match will not advance on its own.
        </p>
      )}
    </div>
  );
}
