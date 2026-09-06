import type { Question, Student } from "@/types";

type Props = {
  student: Student;
  question: Question;
  canReshuffle: boolean;
  onMarkComplete: () => void;
  onSkip: () => void;
  onReshuffle: () => void;
};

export default function MatchCard({ student, question, canReshuffle, onMarkComplete, onSkip, onReshuffle }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-px bg-zinc-200 md:grid-cols-2">
        <section className="bg-white p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Student</p>
          <p className="mt-2 font-mono text-lg text-zinc-600">{student.studentNumber}</p>
          <p className="mt-1 text-3xl font-semibold leading-tight text-zinc-900">{student.fullName}</p>
        </section>
        <section className="bg-white p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Question</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">{question.topic}</span>
            <span className="font-mono text-sm text-zinc-500">{question.questionId}</span>
          </div>
          <p className="mt-3 text-2xl font-medium leading-snug text-zinc-900">{question.questionText}</p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <button
          type="button"
          onClick={onMarkComplete}
          className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Mark Complete
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100"
        >
          Skip / Student Absent
        </button>
        <button
          type="button"
          onClick={onReshuffle}
          disabled={!canReshuffle}
          title={canReshuffle ? "Keep this student, pick a different question" : "No other questions left to pick from"}
          className="ml-auto text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          Reshuffle Question
        </button>
      </div>
    </div>
  );
}
