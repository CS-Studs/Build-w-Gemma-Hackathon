export type ActiveStudySession = {
  id: string;
  title: string;
  startedAt: string;
  accumulatedMs: number;
  runningSince: string | null;
};

export type CompletedStudySession = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type StoredStudySessions = {
  version: 1;
  active: ActiveStudySession | null;
  history: CompletedStudySession[];
};

export const STUDY_SESSION_STORAGE_KEY = "studyduck.study-sessions.v1";
export const STUDY_SESSIONS_CHANGED_EVENT =
  "studyduck:study-sessions-changed";

const EMPTY_STATE: StoredStudySessions = {
  version: 1,
  active: null,
  history: [],
};

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isActiveSession(value: unknown): value is ActiveStudySession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as ActiveStudySession;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    session.title.trim().length > 0 &&
    isValidDate(session.startedAt) &&
    isNonNegativeNumber(session.accumulatedMs) &&
    (session.runningSince === null || isValidDate(session.runningSince))
  );
}

function isCompletedSession(value: unknown): value is CompletedStudySession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as CompletedStudySession;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    session.title.trim().length > 0 &&
    isValidDate(session.startedAt) &&
    isValidDate(session.endedAt) &&
    isNonNegativeNumber(session.durationMs)
  );
}

export function loadStudySessions(): StoredStudySessions {
  try {
    const raw = localStorage.getItem(STUDY_SESSION_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return EMPTY_STATE;

    const stored = value as StoredStudySessions;
    if (
      stored.version !== 1 ||
      (stored.active !== null && !isActiveSession(stored.active)) ||
      !Array.isArray(stored.history) ||
      !stored.history.every(isCompletedSession)
    ) {
      return EMPTY_STATE;
    }
    return stored;
  } catch {
    return EMPTY_STATE;
  }
}

export function saveStudySessions(sessions: StoredStudySessions): void {
  try {
    localStorage.setItem(STUDY_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Subscribers still receive the in-memory update when storage is blocked.
  }

  window.dispatchEvent(
    new CustomEvent<StoredStudySessions>(STUDY_SESSIONS_CHANGED_EVENT, {
      detail: sessions,
    }),
  );
}

export function elapsedForSession(
  session: ActiveStudySession,
  now: number,
): number {
  if (!session.runningSince) return session.accumulatedMs;
  return Math.max(
    0,
    session.accumulatedMs + now - Date.parse(session.runningSince),
  );
}

export function formatSessionDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}
