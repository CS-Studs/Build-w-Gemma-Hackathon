import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWindowDrag } from "../hooks/useWindowDrag";
import { enterWorkspace } from "../windows";
import { Duck } from "./Duck";
import {
  type ActiveStudySession,
  STUDY_SESSION_STORAGE_KEY,
  elapsedForSession,
  formatSessionDuration,
  loadStudySessions,
} from "./studySessionStore";
import "./Widget.css";

function WidgetStudyTimer() {
  const [active, setActive] = useState<ActiveStudySession | null>(
    () => loadStudySessions().active,
  );
  const [now, setNow] = useState(Date.now);
  const running = Boolean(active?.runningSince);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const syncTimer = (event: StorageEvent) => {
      if (event.key === STUDY_SESSION_STORAGE_KEY) {
        setActive(loadStudySessions().active);
        setNow(Date.now());
      }
    };
    window.addEventListener("storage", syncTimer);
    return () => window.removeEventListener("storage", syncTimer);
  }, []);

  if (!active) return null;

  const elapsed = formatSessionDuration(elapsedForSession(active, now));
  return (
    <div
      className={`widget__timer${running ? "" : " is-paused"}`}
      role="timer"
      aria-label={`${active.title}: ${elapsed} elapsed${
        running ? "" : ", paused"
      }`}
      title={active.title}
    >
      <span>{elapsed}</span>
      {!running && <span className="widget__timer-state">Paused</span>}
    </div>
  );
}

/** The floating duck: drag to move it, click to open the workspace. */
export function Widget() {
  const { held, handlers } = useWindowDrag(() => {
    void enterWorkspace();
  });

  useEffect(() => {
    const blockMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", blockMenu);
    return () => document.removeEventListener("contextmenu", blockMenu);
  }, []);

  return (
    <div className="widget">
      <button
        className="widget__quit"
        title="Close StudyDuck"
        aria-label="Close StudyDuck"
        onClick={() => void getCurrentWindow().close()}
      >
        ×
      </button>

      <div className={held ? "widget__float is-held" : "widget__float"}>
        <div
          className={held ? "widget__duck is-held" : "widget__duck"}
          {...handlers}
        >
          <Duck />
          <WidgetStudyTimer />
        </div>
      </div>
    </div>
  );
}
