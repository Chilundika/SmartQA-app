import type { Question } from "../types/index.ts";

export type TopicCoverage = {
  topic: string;
  used: number;
  remaining: number;
  total: number;
};

export function topicCoverage(questions: readonly Pick<Question, "topic" | "status">[]): TopicCoverage[] {
  const map = new Map<string, TopicCoverage>();
  for (const q of questions) {
    const topic = q.topic.trim() || "Untitled";
    const row = map.get(topic) ?? { topic, used: 0, remaining: 0, total: 0 };
    row.total += 1;
    if (q.status === "used") row.used += 1;
    else row.remaining += 1;
    map.set(topic, row);
  }
  return [...map.values()].sort((a, b) => a.topic.localeCompare(b.topic, undefined, { sensitivity: "base" }));
}
