type Props = {
  studentsRemaining: number;
  studentsTotal: number;
  questionsRemaining: number;
  questionsTotal: number;
  className?: string;
};

export default function SessionCounters({
  studentsRemaining,
  studentsTotal,
  questionsRemaining,
  questionsTotal,
  className,
}: Props) {
  return (
    <dl className={`flex gap-3 ${className ?? ""}`}>
      <Counter label="Students remaining" value={studentsRemaining} total={studentsTotal} />
      <Counter label="Questions remaining" value={questionsRemaining} total={questionsTotal} />
    </dl>
  );
}

function Counter({ label, value, total }: { label: string; value: number; total: number }) {
  const exhausted = value === 0;
  return (
    <div className={`rounded-md border px-3 py-2 ${exhausted ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-white"}`}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-zinc-900">
        {value} <span className="text-sm font-normal text-zinc-500">/ {total}</span>
      </dd>
    </div>
  );
}
