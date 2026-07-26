import { useEffect, useRef, useState } from "react";
import {
  type ActivityState,
  applyObservation,
  emptyActivity,
  restartRun,
  saveTotals,
} from "../activity";
import { analyseDesktop, recordAnalysisFailure } from "../screenAnalysis";

export type DesktopWatch = {
  /** How long the user has spent on what, and what they are on now. */
  activity: ActivityState;
  /** What the duck had to say about the most recent reading. */
  line: string;
};

/**
 * Captures and classifies the desktop on a fixed interval while `enabled`,
 * returning the running record of what the user has been doing.
 *
 * Scoping is two layered gates. Only the widget window renders the component
 * that calls this, so the loop cannot outlive the duck; `enabled` then narrows
 * that to the stretches where the study timer is actually counting, so an idle
 * duck neither photographs the screen nor spends quota.
 */
export function useDesktopAnalysis(
  intervalMs: number,
  enabled: boolean,
): DesktopWatch {
  const [activity, setActivity] = useState<ActivityState>(emptyActivity);
  const [line, setLine] = useState("");

  // The loop is started once and outlives any particular reading, so it cannot
  // close over the run in progress. It needs to, though: the model is told how
  // long the user has been at this, and that is only knowable here.
  const current = useRef(activity);
  useEffect(() => {
    current.current = activity;
  });

  // Starting or stopping the loop discards the run in progress. Whatever the
  // user did while the duck was not looking must not count for or against them.
  useEffect(() => {
    setActivity((previous) => restartRun(previous));
    setLine("");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // A round trip to Gemma can outlast the interval on a slow connection, so
    // ticks are skipped rather than allowed to pile up.
    let inFlight = false;
    let stopped = false;

    const tick = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const run = current.current;
        const elapsed = run.category === null ? null : Date.now() - run.since;

        const { category, line: said } = await analyseDesktop(elapsed);
        // An unparseable reply is dropped rather than guessed at, which leaves
        // the current run intact instead of breaking it on a garbled line.
        if (category && !stopped) {
          const at = Date.now();
          setActivity((previous) => applyObservation(previous, category, at));
          setLine(said);
        }
      } catch (error) {
        console.error("desktop analysis failed", error);
        // Best effort: if this fails too there is nowhere left to report it.
        await recordAnalysisFailure(error).catch(() => {});
      } finally {
        inFlight = false;
      }
    };

    // Look at the desktop the moment the timer starts rather than leaving the
    // first interval to expire, so a session produces a note immediately.
    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled]);

  useEffect(() => {
    saveTotals(activity.totals);
  }, [activity.totals]);

  return { activity, line };
}
