import { useEffect, useRef, useState } from "react";

export type SpeechCycleOptions = {
  /** How long a line stays up. */
  visibleMs?: number;
  /** The quiet gap between two lines. */
  hiddenMs?: number;
};

export type SpeechCycle = {
  text: string;
  visible: boolean;
};

/**
 * Walks a list of lines forever: show one, hide it, show the next.
 *
 * Starts hidden so the first line animates in rather than being there already,
 * and the text only swaps at the moment the bubble becomes visible -- otherwise
 * the words would change mid fade-out.
 */
export function useSpeechCycle(
  lines: readonly string[],
  { visibleMs = 2600, hiddenMs = 900 }: SpeechCycleOptions = {},
): SpeechCycle {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState(lines[0] ?? "");

  // Kept in a ref so a fresh array literal from the caller cannot restart the timer.
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  });

  useEffect(() => {
    if (linesRef.current.length === 0) return;

    const timer = window.setTimeout(
      () => {
        if (visible) {
          setVisible(false);
          setIndex((current) => (current + 1) % linesRef.current.length);
        } else {
          setText(linesRef.current[index] ?? "");
          setVisible(true);
        }
      },
      visible ? visibleMs : hiddenMs,
    );

    return () => window.clearTimeout(timer);
  }, [visible, index, visibleMs, hiddenMs]);

  return { text, visible };
}
