import { useCallback, useEffect, useRef, useState } from "react";
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

/** How often the duck considers whether it has anything to say. */
const TICK_MS = 1_000;

/**
 * How soon an attempt that produced no line may be repeated, doubling with each
 * further failure up to the ceiling.
 *
 * A flat retry is the wrong shape here. The usual reason a line does not come
 * back is that the key is already saturated by the screenshots, and retrying
 * every five seconds adds to exactly the load that caused it. Backing off lets
 * the queue drain instead of feeding it.
 */
const RETRY_AFTER_MS = 5_000;
const RETRY_CEILING_MS = 60_000;

/**
 * The duck's speech bubble, written by Gemma from what the screen has shown.
 *
 * Two things make it talk: the moment the user switches between working and not
 * (the same moment the duck's face changes, so the two land together), and then
 * once a minute for as long as they stay on it. A remark takes seconds to come
 * back, so the line follows the new face rather than arriving with it.
 *
 * Both are decided by one timer that is started once and never rebuilt, reading
 * everything it needs from refs. The obvious shape -- an effect per rule, keyed
 * on the current activity -- puts a timer and an in-flight request inside
 * something that is torn down and recreated whenever the activity changes,
 * which is precisely when the duck has something to say. Anything the duck must
 * not miss therefore lives outside the render cycle entirely.
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

  const latest = useRef({ activity, note, enabled });
  useEffect(() => {
    latest.current = { activity, note, enabled };
  });

  // Which run has been noticed, what came before it, and which one has had its
  // reaction. A run is identified by its start, which only moves when the
  // category does.
  const seenRun = useRef<number | null>(null);
  const runCategory = useRef<ActivityCategory | null>(null);
  const previousCategory = useRef<ActivityCategory | null>(null);
  const reactedTo = useRef<number | null>(null);

  // One request at a time: a nudge that came due while a reaction was still
  // being written would talk over it.
  const speaking = useRef(false);
  const lastAttempt = useRef(0);
  const lastSpoke = useRef(0);
  const failures = useRef(0);

  /**
   * Asks for a line and shows it, reporting whether one reached the bubble.
   *
   * Whether a remark is still wanted depends on the run it describes and
   * nothing else. Tying that to the lifetime of an effect instead loses the
   * reply whenever the component happens to re-render mid-request.
   */
  const speak = useCallback(
    async (
      since: number,
      category: ActivityCategory,
      elapsedMs: number,
      previous: ActivityCategory | null,
    ): Promise<boolean> => {
      speaking.current = true;
      const asked = Date.now();

      try {
        const { text, why } = await composeRemark({
          category,
          previous,
          note: latest.current.note,
          elapsedMs,
        });

        // The screen may have moved on while the line was being written; a
        // remark about the old stretch is no longer true.
        const current =
          latest.current.enabled && latest.current.activity.since === since;
        if (!text || !current) {
          failures.current += 1;
          // A dropped line used to leave no trace at all, which made a duck
          // that stayed quiet indistinguishable from one that was never asked.
          await logNote(
            `SAID NOTHING: ${current ? why : "the run had already moved on"}`,
          ).catch(() => {});
          return false;
        }

        setUtterance((previousUtterance) => ({
          id: (previousUtterance?.id ?? 0) + 1,
          text,
        }));
        lastSpoke.current = Date.now();
        failures.current = 0;
        // Filed alongside the readings that prompted it, so the log reads back
        // as what the duck saw and what it said about it, in order. The round
        // trip is worth recording next to it: how late a line is says which of
        // the two models to blame when the duck feels slow.
        const took = ((Date.now() - asked) / 1000).toFixed(1);
        await logNote(`SAID (${took}s): ${text}`).catch(() => {});
        return true;
      } catch (error) {
        failures.current += 1;
        const detail = error instanceof Error ? error.message : String(error);
        // Same reasoning as the classifier: the widget's devtools are out of
        // reach, so the log on disk is the only place a failure is visible.
        await logNote(`SPEECH FAILED: ${detail}`).catch(() => {});
        return false;
      } finally {
        speaking.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const tick = () => {
      const { activity: current, enabled: watching } = latest.current;
      const { category, since } = current;
      if (!watching || !category || speaking.current) return;

      if (seenRun.current !== since) {
        seenRun.current = since;
        previousCategory.current = runCategory.current;
        runCategory.current = category;
        // A switch is the one moment worth interrupting for, so it is not held
        // up by the pause that paces retries after a failure. Switches are
        // minutes apart, so this cannot become a way round the backoff.
        lastAttempt.current = 0;
        failures.current = 0;
      }

      const now = Date.now();
      const wait = Math.min(
        RETRY_AFTER_MS * 2 ** failures.current,
        RETRY_CEILING_MS,
      );
      if (now - lastAttempt.current < wait) return;

      // The reaction to the switch comes first, and keeps being retried until
      // something reaches the bubble: a run that changed the duck's face
      // without a word to go with it is the one outcome worth avoiding.
      if (reactedTo.current !== since) {
        reactedTo.current = since;
        lastAttempt.current = now;
        void speak(since, category, 0, previousCategory.current).then(
          (spoke) => {
            if (!spoke && reactedTo.current === since) reactedTo.current = null;
          },
        );
        return;
      }

      if (now - lastSpoke.current >= NUDGE_EVERY_MS) {
        lastAttempt.current = now;
        void speak(since, category, now - since, null);
      }
    };

    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [speak]);

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
