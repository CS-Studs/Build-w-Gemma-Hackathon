import { useEffect } from "react";
import { analyseDesktop, recordAnalysisFailure } from "../screenAnalysis";

/**
 * Captures and classifies the desktop on a fixed interval while mounted.
 *
 * Mounting is the whole scoping mechanism: only the widget window renders the
 * component that calls this, so the loop starts when the duck appears and dies
 * with the window when it swaps to the workspace.
 */
export function useDesktopAnalysis(intervalMs: number) {
  useEffect(() => {
    // A round trip to Gemma can outlast the interval on a slow connection, so
    // ticks are skipped rather than allowed to pile up.
    let inFlight = false;
    let stopped = false;

    const tick = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        await analyseDesktop();
      } catch (error) {
        console.error("desktop analysis failed", error);
        // Best effort: if this fails too there is nowhere left to report it.
        await recordAnalysisFailure(error).catch(() => {});
      } finally {
        inFlight = false;
      }
    };

    // Look at the desktop as soon as the duck appears rather than leaving the
    // first interval to expire, so a fresh run produces a note immediately.
    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
