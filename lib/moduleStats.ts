import { loadSessionsForModule } from "./sessionStorage.ts";

export type TopicUse = {
  topic: string;
  used: number;
  remaining: number;
};

export type ModuleStats = {
  displayName: string;
  sessionCount: number;
  uniqueStudentsTested: number;
  completedMatches: number;
  topics: TopicUse[];
  mostUsed: TopicUse | null;
  leastUsed: TopicUse | null;
};

/** Read-only aggregates. Never writes to localStorage. */
export function computeModuleStats(moduleName: string): ModuleStats {
  const sessions = loadSessionsForModule(moduleName);
  const displayName = sessions[0]?.moduleName.trim() || moduleName.trim();
  const tested = new Set<string>();
  let completedMatches = 0;
  const topicMap = new Map<string, TopicUse>();

  for (const session of sessions) {
    for (const match of session.matches) {
      if (match.outcome !== "completed") continue;
      completedMatches += 1;
      const num = match.student.studentNumber.trim();
      if (num) tested.add(num.toLowerCase());
    }
    for (const question of session.questions) {
      const topic = question.topic.trim() || "Untitled";
      const row = topicMap.get(topic) ?? { topic, used: 0, remaining: 0 };
      if (question.status === "used") row.used += 1;
      else row.remaining += 1;
      topicMap.set(topic, row);
    }
  }

  const topics = [...topicMap.values()].sort(
    (a, b) => b.used - a.used || a.topic.localeCompare(b.topic, undefined, { sensitivity: "base" }),
  );
  const mostUsed = topics[0] ?? null;
  const leastUsed =
    topics.length === 0
      ? null
      : [...topics].sort(
          (a, b) => a.used - b.used || a.topic.localeCompare(b.topic, undefined, { sensitivity: "base" }),
        )[0];

  return {
    displayName,
    sessionCount: sessions.length,
    uniqueStudentsTested: tested.size,
    completedMatches,
    topics,
    mostUsed,
    leastUsed,
  };
}
