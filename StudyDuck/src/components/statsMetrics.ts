import type { CompletedStudySession } from "./studySessionStore";

export type TaskSummary = { completed: number; total: number };

export type SessionStatistics = {
  totalMs: number;
  longestMs: number;
  currentStreak: number;
  longestStreak: number;
  productivePeriod: string | null;
};

export type MetricCard = {
  label: string;
  value: string;
  detail: string;
  state: "available" | "empty" | "unavailable";
};

export type MetricGroup = {
  title: string;
  description: string;
  metrics: MetricCard[];
};

const TODO_STORAGE_KEY = "studyduck.todo-board.v2";

function dayOrdinal(value: string | Date): number | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function formatCompactDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatTotalStudyTime(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

export function calculateSessionStatistics(
  history: CompletedStudySession[],
  now = new Date(),
): SessionStatistics {
  const totalMs = history.reduce((total, session) => total + session.durationMs, 0);
  const longestMs = history.reduce((longest, session) => Math.max(longest, session.durationMs), 0);
  const ordinals = [...new Set(history.map((session) => dayOrdinal(session.startedAt)).filter((day): day is number => day !== null))].sort((a, b) => a - b);

  let longestStreak = 0;
  let runningStreak = 0;
  let previous: number | null = null;
  for (const day of ordinals) {
    runningStreak = previous !== null && day === previous + 1 ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previous = day;
  }

  const today = dayOrdinal(now) ?? 0;
  const latest = ordinals.length > 0 ? ordinals[ordinals.length - 1] : undefined;
  let currentStreak = 0;
  if (latest !== undefined && (latest === today || latest === today - 1)) {
    currentStreak = 1;
    for (let index = ordinals.length - 2; index >= 0; index -= 1) {
      if (ordinals[index] !== ordinals[index + 1] - 1) break;
      currentStreak += 1;
    }
  }

  const periods = [
    { name: "Night", start: 0, end: 6, duration: 0 },
    { name: "Morning", start: 6, end: 12, duration: 0 },
    { name: "Afternoon", start: 12, end: 18, duration: 0 },
    { name: "Evening", start: 18, end: 24, duration: 0 },
  ];
  for (const session of history) {
    const date = new Date(session.startedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const period = periods.find((candidate) => date.getHours() >= candidate.start && date.getHours() < candidate.end);
    if (period) period.duration += session.durationMs;
  }
  const productive = periods.reduce((best, period) => period.duration > best.duration ? period : best, periods[0]);

  return {
    totalMs,
    longestMs,
    currentStreak,
    longestStreak,
    productivePeriod: history.length > 0 ? productive.name : null,
  };
}

function countItems(lists: unknown): TaskSummary | null {
  if (!Array.isArray(lists)) return null;
  let completed = 0;
  let total = 0;
  for (const candidate of lists) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const items = (candidate as { items?: unknown }).items;
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (typeof item !== "object" || item === null || typeof (item as { completed?: unknown }).completed !== "boolean") return null;
      total += 1;
      if ((item as { completed: boolean }).completed) completed += 1;
    }
  }
  return { completed, total };
}

export function loadTaskSummary(): TaskSummary {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (!raw) return { completed: 0, total: 0 };
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== 2) return { completed: 0, total: 0 };
    const board = value as { ungroupedLists?: unknown; projects?: unknown };
    const ungrouped = countItems(board.ungroupedLists);
    if (!ungrouped || !Array.isArray(board.projects)) return { completed: 0, total: 0 };
    const result = { ...ungrouped };
    for (const candidate of board.projects) {
      if (typeof candidate !== "object" || candidate === null) return { completed: 0, total: 0 };
      const project = countItems((candidate as { lists?: unknown }).lists);
      if (!project) return { completed: 0, total: 0 };
      result.completed += project.completed;
      result.total += project.total;
    }
    return result;
  } catch {
    return { completed: 0, total: 0 };
  }
}

export function buildMetricGroups(
  history: CompletedStudySession[],
  tasks: TaskSummary,
): MetricGroup[] {
  const sessions = calculateSessionStatistics(history);
  const hasSessions = history.length > 0;
  const unavailable = (label: string, detail: string): MetricCard => ({ label, value: "Not tracked yet", detail, state: "unavailable" });
  const sessionMetric = (label: string, value: string, detail: string): MetricCard => ({ label, value: hasSessions ? value : "No sessions yet", detail, state: hasSessions ? "available" : "empty" });

  return [
    {
      title: "Time",
      description: "How your completed study time is distributed.",
      metrics: [
        { label: "Total session time", value: formatTotalStudyTime(sessions.totalMs), detail: "Completed sessions", state: "available" },
        unavailable("Estimated focused time", "Requires focus and idle classification."),
        unavailable("Planned versus actual time", "Requires planned session durations."),
        sessionMetric("Longest focus period", formatCompactDuration(sessions.longestMs), "Longest completed session"),
        sessionMetric("Most productive time of day", sessions.productivePeriod ?? "", "By completed duration and start time"),
      ],
    },
    {
      title: "Tasks",
      description: "A snapshot of your current to-do board.",
      metrics: [{
        label: "Task completion rate",
        value: tasks.total > 0 ? `${Math.round((tasks.completed / tasks.total) * 100)}%` : "No tasks yet",
        detail: tasks.total > 0 ? `${tasks.completed} of ${tasks.total} current tasks complete` : "Add tasks to begin measuring",
        state: tasks.total > 0 ? "available" : "empty",
      }],
    },
    {
      title: "Focus support",
      description: "Signals that will measure interruptions and assistance.",
      metrics: [
        unavailable("Number of distractions", "Requires distraction event tracking."),
        unavailable("Number of stuck events", "Requires stuck-event tracking."),
        unavailable("Intervention acceptance rate", "Requires intervention outcomes."),
        unavailable("Recovery time after intervention", "Requires intervention and resumed-focus timestamps."),
      ],
    },
    {
      title: "Habits",
      description: "Consistency across your study routine.",
      metrics: [
        sessionMetric("Current and longest streak", `${sessions.currentStreak} / ${sessions.longestStreak} days`, "Current / longest study-day streak"),
        unavailable("Weekly goal progress", "Requires a weekly goal setting."),
      ],
    },
  ];
}
