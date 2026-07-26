import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type CompletedStudySession,
  type StoredStudySessions,
  STUDY_SESSIONS_CHANGED_EVENT,
  STUDY_SESSION_STORAGE_KEY,
  loadStudySessions,
} from "./studySessionStore";
import {
  buildMetricGroups,
  calculateSessionStatistics,
  formatTotalStudyTime,
  loadTaskSummary,
} from "./statsMetrics";
import { TODO_BOARD_CHANGED_EVENT } from "./todoBoardStore";
import "./StatsSection.css";

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

/** Opens the workspace statistics surface. Statistics content is added separately. */
export function StatsSection() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CompletedStudySession[]>(
    () => loadStudySessions().history,
  );
  const [tasks, setTasks] = useState(loadTaskSummary);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sessionStats = useMemo(
    () => calculateSessionStatistics(history),
    [history],
  );
  const metricGroups = useMemo(
    () => buildMetricGroups(history, tasks),
    [history, tasks],
  );

  const closeModal = () => setOpen(false);

  useEffect(() => {
    const handleSessionChange = (event: Event) => {
      const sessions = (event as CustomEvent<StoredStudySessions>).detail;
      setHistory(sessions.history);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STUDY_SESSION_STORAGE_KEY) {
        setHistory(loadStudySessions().history);
      }
      if (event.key === "studyduck.todo-board.v2") {
        setTasks(loadTaskSummary());
      }
    };
    const handleBoardChange = () => setTasks(loadTaskSummary());
    window.addEventListener(STUDY_SESSIONS_CHANGED_EVENT, handleSessionChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(TODO_BOARD_CHANGED_EVENT, handleBoardChange);
    return () => {
      window.removeEventListener(STUDY_SESSIONS_CHANGED_EVENT, handleSessionChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(TODO_BOARD_CHANGED_EVENT, handleBoardChange);
    };
  }, []);

  useEffect(() => {
    if (open) setTasks(loadTaskSummary());
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="stats-section"
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="stats-section__copy">
          <span className="stats-section__eyebrow">Your progress</span>
          <strong>Statistics</strong>
          <span className="stats-section__hint">Open study insights</span>
        </span>
        <span className="stats-section__total" aria-live="polite">
          <strong>{formatTotalStudyTime(sessionStats.totalMs)}</strong>
          <span>Total studied</span>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="stats-modal__backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <section
              className="stats-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stats-modal-title"
              aria-describedby="stats-modal-description"
            >
              <header className="stats-modal__header">
                <div>
                  <p className="stats-modal__eyebrow">Your progress</p>
                  <h2 id="stats-modal-title">Statistics</h2>
                  <p id="stats-modal-description">
                    Your study insights will live here.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  className="stats-modal__close"
                  type="button"
                  aria-label="Close statistics"
                  onClick={closeModal}
                >
                  <CloseIcon />
                </button>
              </header>
              <div className="stats-modal__body">
                {metricGroups.map((group) => (
                  <section className="stats-dashboard__group" key={group.title}>
                    <header className="stats-dashboard__group-header">
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                    </header>
                    <div className="stats-dashboard__grid">
                      {group.metrics.map((metric) => (
                        <article
                          className={`stats-metric stats-metric--${metric.state}`}
                          key={metric.label}
                        >
                          <p className="stats-metric__label">{metric.label}</p>
                          <strong className="stats-metric__value">{metric.value}</strong>
                          <p className="stats-metric__detail">{metric.detail}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
