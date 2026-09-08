"use client";

import { useEffect, useState } from "react";

type Piece = { id: number; left: number; delay: number; color: string; rotate: number };

const COLORS = ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7", "#06b6d4"];

export default function ConfettiBurst({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    setPieces(
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    );
    const later = window.setTimeout(() => setPieces([]), 2800);
    return () => clearTimeout(later);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden print:hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-12px] h-3 w-2 animate-confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              "--r": `${p.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
