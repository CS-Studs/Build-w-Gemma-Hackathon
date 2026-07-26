import { useEffect, useState } from "react";
import { useWindowDrag } from "../hooks/useWindowDrag";
import { useSpeechCycle } from "../hooks/useSpeechCycle";
import { useDesktopAnalysis } from "../hooks/useDesktopAnalysis";
import { enterWorkspace } from "../windows";
import { IDLE_LINES } from "../speech";
import { Duck } from "./Duck";
import { SpeechBubble } from "./SpeechBubble";
import {
  type ActiveStudySession,
  STUDY_SESSION_STORAGE_KEY,
  elapsedForSession,
  formatSessionDuration,
  loadStudySessions,
} from "./studySessionStore";
import "./Widget.css";

/** How often the duck looks at the desktop while it is floating. */
const ANALYSIS_INTERVAL_MS = 15_000;

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
  const speech = useSpeechCycle(IDLE_LINES);

  useDesktopAnalysis(ANALYSIS_INTERVAL_MS);

  useEffect(() => {
    const blockMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", blockMenu);
    return () => document.removeEventListener("contextmenu", blockMenu);
  }, []);

  return (
    <div className="widget">
      <div className={held ? "widget__float is-held" : "widget__float"}>
        <SpeechBubble text={speech.text} visible={speech.visible} />
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
