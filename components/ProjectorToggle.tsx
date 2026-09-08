"use client";

type Props = {
  on: boolean;
  onToggle: () => void;
};

export default function ProjectorToggle({ on, onToggle }: Props) {
  return (
    <button
      type="button"
      title={on ? "Exit projector display mode" : "Enter projector display mode"}
      aria-label={on ? "Exit projector display mode" : "Enter projector display mode"}
      aria-pressed={on}
      onClick={onToggle}
      className="inline-flex h-11 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="4" width="18" height="12" rx="1" />
        <path d="M8 20h8M12 16v4" />
      </svg>
      <span className="text-xs font-medium">Projector</span>
    </button>
  );
}
