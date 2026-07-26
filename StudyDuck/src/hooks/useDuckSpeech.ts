import { useEffect, useRef, useState } from "react";
import type { ActivityState } from "../activity";
import { composeRemark } from "../duckSpeech";
import { logNote, type ActivityCategory } from "../screenAnalysis";

export type DuckSpeech = {
  text: string;
  visible: boolean;
};

/** How long a line stays up before the bubble fades out. */
const BUBBLE_MS = 7_000;

/** How often the duck speaks up again while the user carries on doing the same thing. */
const NUDGE_EVERY_MS = 60_000;

/**
 * The duck's speech bubble, written by Gemma from what the screen has shown.
 *
 * Two things make it talk: the moment the user switches between working and not
 * (the same moment the duck's face changes, so the two land together), and then
 * once a minute for as long as they stay on it. A remark takes a second or two
 * to come back, so the line follows the new face rather than arriving with it.
 *
 * `note` is the current reading and changes every few seconds, so it is read
 * through a ref: putting it in the dependencies would restart the minute timer
 * -- and fire a fresh remark -- on every glance at the screen.
 */
export function useDuckSpeech(
  activity: ActivityState,
  note: string,
  enabled: boolean,
): DuckSpeech {
  const [utterance, setUtterance] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [visible, setVisible] = useState(false);

  const latest = useRef({ activity, note });
  useEffect(() => {
    latest.current = { activity, note };
  });

  // What the user was doing before the current stretch, and which stretch has
  // already had its reaction. Both survive a remount, so React's development
  // double-mount cannot make the duck react to the same switch twice.
  const previousCategory = useRef<ActivityCategory | null>(null);
  const reactedTo = useRef<number | null>(null);

  useEffect(() => {
    const { category, since } = activity;
    if (!enabled || !category) return;

    let stopped = false;

    const speak = async (elapsedMs: number, previous: ActivityCategory | null) => {
      // The screen may have moved on while the last line was still being
      // written; a remark about the old stretch is no longer true.
      if (stopped || latest.current.activity.since !== since) return;

      try {
        const text = await composeRemark({
          category,
          previous,
          note: latest.current.note,
          elapsedMs,
        });
        if (stopped || !text || latest.current.activity.since !== since) return;
        setUtterance((current) => ({ id: (current?.id ?? 0) + 1, text }));
        // Filed alongside the readings that prompted it, so the log reads back
        // as what the duck saw and what it said about it, in order.
        await logNote(`SAID: ${text}`).catch(() => {});
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        // Same reasoning as the classifier: the widget's devtools are out of
        // reach, so the log on disk is the only place a failure is visible.
        await logNote(`SPEECH FAILED: ${detail}`).catch(() => {});
      }
    };

    if (reactedTo.current !== since) {
      reactedTo.current = since;
      const previous = previousCategory.current;
      previousCategory.current = category;
      void speak(0, previous);
    }

    const timer = window.setInterval(() => {
      void speak(Date.now() - since, null);
    }, NUDGE_EVERY_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, activity.category, activity.since]);

  useEffect(() => {
    if (!utterance) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), BUBBLE_MS);
    return () => window.clearTimeout(timer);
  }, [utterance]);

  // A bubble left hanging when the timer stops would be commenting on a screen
  // the duck is no longer watching.
  useEffect(() => {
    if (!enabled) setVisible(false);
  }, [enabled]);

  // The text outlives its own visibility so the bubble has something to show on
  // the way out instead of collapsing to an empty box mid-fade.
  return { text: utterance?.text ?? "", visible };
}
