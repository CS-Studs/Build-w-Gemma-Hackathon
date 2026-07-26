import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type CompletedStudySession,
  type StoredStudySessions,
  STUDY_SESSION_STORAGE_KEY,
  elapsedForSession,
  formatSessionDuration,
  loadStudySessions,
} from "./studySessionStore";
import "./studysession.css";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function createId(): string {
  return crypto.randomUUID();
}

export function StudySession() {
  const [sessions, setSessions] =
    useState<StoredStudySessions>(loadStudySessions);
  const [title, setTitle] = useState("");
  const [now, setNow] = useState(Date.now);
  const [logOpen, setLogOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = sessions.active;
  const running = Boolean(active?.runningSince);
  const elapsedMs = active ? elapsedForSession(active, now) : 0;

  useEffect(() => {
    try {
      localStorage.setItem(STUDY_SESSION_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Session tracking remains available until the current window closes.
    }
  }, [sessions]);

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!logOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setLogOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [logOpen]);

  const startSession = (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || sessions.active) return;

    const startedAt = new Date().toISOString();
    setSessions((current) => ({
      ...current,
      active: {
        id: createId(),
        title: cleanTitle,
        startedAt,
        accumulatedMs: 0,
        runningSince: startedAt,
      },
    }));
    setNow(Date.now());
  };

  const pauseSession = () => {
    const pausedAt = Date.now();
    setSessions((current) => {
      if (!current.active?.runningSince) return current;
      return {
        ...current,
        active: {
          ...current.active,
          accumulatedMs: elapsedForSession(current.active, pausedAt),
          runningSince: null,
        },
      };
    });
    setNow(pausedAt);
  };

  const resumeSession = () => {
    const resumedAt = new Date().toISOString();
    setSessions((current) => {
      if (!current.active || current.active.runningSince) return current;
      return {
        ...current,
        active: { ...current.active, runningSince: resumedAt },
      };
    });
    setNow(Date.now());
  };

  const finishSession = () => {
    const finishedAt = Date.now();
    setSessions((current) => {
      if (!current.active) return current;
      const completed: CompletedStudySession = {
        id: current.active.id,
        title: current.active.title,
        startedAt: current.active.startedAt,
        endedAt: new Date(finishedAt).toISOString(),
        durationMs: elapsedForSession(current.active, finishedAt),
      };
      return {
        ...current,
        active: null,
        history: [completed, ...current.history],
      };
    });
    setTitle("");
    setNow(finishedAt);
  };

  const deleteSession = (session: CompletedStudySession) => {
    if (!window.confirm(`Delete “${session.title}” from the session log?`)) {
      return;
    }
    setSessions((current) => ({
      ...current,
      history: current.history.filter((item) => item.id !== session.id),
    }));
  };

  return (
    <div className="study-session" ref={rootRef}>
      <div className="study-session__main">
        <div className="study-session__focus-row">
          <div className="study-session__identity">
            <p className="study-session__eyebrow">Focus timer</p>
            <h2>{active ? active.title : "Study session"}</h2>
            {active && (
              <>
                <p className="study-session__started">
                  Started {formatDateTime(active.startedAt)}
                </p>
                <span
                  className={`study-session__status${
                    running ? "" : " is-paused"
                  }`}
                >
                  <span aria-hidden="true" />
                  {running ? "In progress" : "Paused"}
                </span>
              </>
            )}
          </div>
          <div
            className={`study-session__timer${
              active && !running ? " is-paused" : ""
            }`}
            role="timer"
            aria-label={`${formatSessionDuration(elapsedMs)} elapsed`}
          >
            {formatSessionDuration(elapsedMs)}
          </div>
          <div className="study-session__focus-actions">
            {active && (
              <>
                <button
                  type="button"
                  className="study-session__button study-session__button--secondary"
                  onClick={running ? pauseSession : resumeSession}
                >
                  {running ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  className="study-session__button study-session__button--finish"
                  onClick={finishSession}
                >
                  Finish
                </button>
              </>
            )}
            <button
              type="button"
              className="study-session__log-trigger"
              aria-label={`${logOpen ? "Close" : "Open"} session log`}
              title="Session log"
              aria-expanded={logOpen}
              aria-controls="study-session-log"
              onClick={() => setLogOpen((open) => !open)}
            >
              <svg
                className={`study-session__log-icon${logOpen ? " is-open" : ""}`}
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="m10 3-5 5 5 5" />
              </svg>
            </button>
          </div>
        </div>

        {!active && (
          <form className="study-session__start" onSubmit={startSession}>
            <label className="study-session__title-field">
              <span className="sr-only">Session title</span>
              <input
                value={title}
                maxLength={80}
                placeholder="What are you studying?"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <button
              className="study-session__button study-session__button--start"
              type="submit"
              disabled={!title.trim()}
            >
              Start
            </button>
          </form>
        )}
      </div>

      {logOpen && (
        <div className="study-session__log" id="study-session-log">
          <div className="study-session__log-header">
            <div>
              <p className="study-session__eyebrow">History</p>
              <h3>Study sessions ({sessions.history.length})</h3>
            </div>
            <button
              type="button"
              className="study-session__close"
              aria-label="Close session log"
              onClick={() => setLogOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="study-session__log-list">
            {sessions.history.length === 0 ? (
              <div className="study-session__empty">
                <p>No completed sessions yet.</p>
                <span>Your finished study sessions will appear here.</span>
              </div>
            ) : (
              sessions.history.map((session) => (
                <article className="study-session__record" key={session.id}>
                  <div className="study-session__record-copy">
                    <h4>{session.title}</h4>
                    <time dateTime={session.startedAt}>
                      {formatDateTime(session.startedAt)}
                    </time>
                  </div>
                  <span className="study-session__duration">
                    {formatSessionDuration(session.durationMs)}
                  </span>
                  <button
                    type="button"
                    className="study-session__delete"
                    aria-label={`Delete ${session.title}`}
                    onClick={() => deleteSession(session)}
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
