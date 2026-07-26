import { useEffect, useState } from "react";
import {
  type ActivityState,
  applyObservation,
  emptyActivity,
  restartRun,
  saveTotals,
} from "../activity";
import { analyseDesktop, recordAnalysisFailure } from "../screenAnalysis";

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
): ActivityState {
  const [activity, setActivity] = useState<ActivityState>(emptyActivity);

  // Starting or stopping the loop discards the run in progress. Whatever the
  // user did while the duck was not looking must not count for or against them.
  useEffect(() => {
    setActivity((previous) => restartRun(previous));
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
        const { category } = await analyseDesktop();
        // An unparseable reply is dropped rather than guessed at, which leaves
        // the current run intact instead of breaking it on a garbled line.
        if (category && !stopped) {
          const at = Date.now();
          setActivity((previous) => applyObservation(previous, category, at));
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

  return activity;
}
