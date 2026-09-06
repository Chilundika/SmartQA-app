"use client";

import { downloadSessionCsv } from "@/lib/exportCsv";
import type { Session } from "@/types";

export default function ExportButtons({ session }: { session: Session }) {
  const empty = session.matches.length === 0;

  return (
    <button
      type="button"
      onClick={() => downloadSessionCsv(session)}
      disabled={empty}
      title={empty ? "No matches to export yet" : "Download this table as a CSV file"}
      className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:shadow-none"
    >
      Export CSV
    </button>
  );
}
