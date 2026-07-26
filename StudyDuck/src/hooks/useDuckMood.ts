import { useEffect, useState } from "react";
import type { ActivityState } from "../activity";

export type DuckMood = "default" | "happy" | "angry";

export type DuckMoodView = {
  mood: DuckMood;
  /** Whether the celebration hearts should be showing. */
  hearts: boolean;
};

/** How long the user may be off task before the duck sulks. */
const ANGRY_AFTER_MS = 15_000;
/** How long the duck stays pleased once work resumes. */
const HAPPY_FOR_MS = 15_000;
/** How long the hearts show at the start of that. */
const HEARTS_FOR_MS = 1_000;
/** How often the elapsed thresholds are re-checked. */
const TICK_MS = 250;

/**
 * The duck's expression, driven by what the screen has been showing.
 *
 * Three states: resting while the user works, sulking once they have been off
 * task for a while, and pleased for a spell when they come back. The pleased
 * state is reachable only from the sulk -- a glance at a browser that never
 * lasted long enough to upset the duck should not earn a reward either.
 */
export function useDuckMood(activity: ActivityState): DuckMoodView {
  const [now, setNow] = useState(Date.now);
  const [mood, setMood] = useState<DuckMood>("default");
  const [happySince, setHappySince] = useState<number | null>(null);

  // The transitions are elapsed-time thresholds, so the machine needs a clock
  // of its own: a reading can leave it one state away from changing with no
  // further readings due for seconds.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const working = activity.category === "work";
    // Before the first reading nothing is known, so the duck waits rather than
    // treating an unread screen as time wasted.
    const offTaskFor =
      activity.category && !working ? now - activity.since : 0;

    if (mood === "angry") {
      if (working) {
        setMood("happy");
        setHappySince(now);
      }
      return;
    }

    if (mood === "happy") {
      if (happySince !== null && now - happySince >= HAPPY_FOR_MS) {
        setMood("default");
        setHappySince(null);
      } else if (offTaskFor >= ANGRY_AFTER_MS) {
        // Wandering off again cuts the celebration short.
        setMood("angry");
        setHappySince(null);
      }
      return;
    }

    if (offTaskFor >= ANGRY_AFTER_MS) setMood("angry");
  }, [now, activity, mood, happySince]);

  return {
    mood,
    hearts:
      mood === "happy" &&
      happySince !== null &&
      now - happySince < HEARTS_FOR_MS,
  };
}
