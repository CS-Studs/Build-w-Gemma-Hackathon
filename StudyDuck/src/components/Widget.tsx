import { useEffect, useState } from "react";
import { useWindowDrag } from "../hooks/useWindowDrag";
import { useDesktopAnalysis } from "../hooks/useDesktopAnalysis";
import { useActiveStudySession } from "../hooks/useActiveStudySession";
import { useDuckMood } from "../hooks/useDuckMood";
import { useDuckSpeech } from "../hooks/useDuckSpeech";
import { enterWorkspace } from "../windows";
import { Duck } from "./Duck";
import { SpeechBubble } from "./SpeechBubble";
import {
  type ActiveStudySession,
  elapsedForSession,
  formatSessionDuration,
} from "./studySessionStore";
import "./Widget.css";

/** How often the duck looks at the desktop while a session is counting. */
const ANALYSIS_INTERVAL_MS = 5_000;

function WidgetStudyTimer({ session }: { session: ActiveStudySession | null }) {
  const [now, setNow] = useState(Date.now);
  const running = Boolean(session?.runningSince);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  // Re-read the clock whenever the session changes so a resumed timer shows the
  // right figure straight away instead of waiting out the next tick.
  useEffect(() => setNow(Date.now()), [session]);

  if (!session) return null;

  const elapsed = formatSessionDuration(elapsedForSession(session, now));
  return (
    <div
      className={`widget__timer${running ? "" : " is-paused"}`}
      role="timer"
      aria-label={`${session.title}: ${elapsed} elapsed${
        running ? "" : ", paused"
      }`}
      title={session.title}
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
  const session = useActiveStudySession();

  // Only watch the desktop while a session is actually counting. A paused or
  // absent timer means the user is not studying, so there is nothing to judge.
  const studying = Boolean(session?.runningSince);
  const { activity, line } = useDesktopAnalysis(ANALYSIS_INTERVAL_MS, studying);
  const { mood, hearts } = useDuckMood(activity);
  const speech = useDuckSpeech(activity, line, studying);

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
          <Duck mood={mood} hearts={hearts} />
          <WidgetStudyTimer session={session} />
        </div>
      </div>
    </div>
  );
}
