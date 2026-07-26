import { useEffect, useRef, useState } from "react";
import type { ActivityState } from "../activity";
import { logNote } from "../screenAnalysis";

export type DuckSpeech = {
  text: string;
  visible: boolean;
};

/** How long a line stays up before the bubble fades out. */
const BUBBLE_MS = 7_000;

/** How often the duck speaks up again while the user carries on doing the same thing. */
const NUDGE_EVERY_MS = 60_000;

/**
 * Decides when the duck says what the screen reading already came back with.
 *
 * Nothing here talks to an API. Every reading arrives with a line attached, so
 * this only has to choose which of them reach the bubble: the first of a new
 * run, so a switch is remarked on the moment the duck's face changes, and one a
 * minute after that for as long as the user stays on it.
 *
 * That the line comes free with the reading is the whole point. It used to be a
 * second request built from the first one's answer, which meant it could only
 * ever land after the mood it belonged to, and often not at all.
 */
export function useDuckSpeech(
  activity: ActivityState,
  line: string,
  enabled: boolean,
): DuckSpeech {
  const [utterance, setUtterance] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [visible, setVisible] = useState(false);

  // The run already spoken for, and when the duck last said anything. Refs, so
  // a development double-mount cannot make it react to the same switch twice.
  const spokenRun = useRef<number | null>(null);
  const lastSpoke = useRef(0);

  useEffect(() => {
    const { category, since } = activity;
    if (!enabled || !category || !line) return;

    // A run is identified by its start, which only moves when the category
    // does, so this is true exactly once per switch.
    const switched = spokenRun.current !== since;
    const now = Date.now();
    if (!switched && now - lastSpoke.current < NUDGE_EVERY_MS) return;

    spokenRun.current = since;
    lastSpoke.current = now;
    setUtterance((previous) => ({ id: (previous?.id ?? 0) + 1, text: line }));
    void logNote(`SAID: ${line}`).catch(() => {});
    // `activity` rather than its parts: its identity changes with every reading,
    // which is exactly how often this needs to reconsider.
  }, [enabled, activity, line]);

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
