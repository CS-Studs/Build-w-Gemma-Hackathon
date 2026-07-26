import { invoke } from "@tauri-apps/api/core";
import { ai, VISION_MODEL } from "./gemma";

/** The three buckets a screenshot can fall into. */
export const ACTIVITY_CATEGORIES = ["work", "entertainment", "desktop"] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_SYSTEM_PROMPT = `You classify what a person is doing from a single screenshot of their desktop.

Choose exactly one category:
- work: studying, reading, writing, coding, research, documents, email, spreadsheets, lecture material.
- entertainment: video, streaming, games, social media, shopping, chat that is clearly not study related.
- desktop: an empty or near-empty desktop, a lock screen, a screensaver, a file manager, settings, or nothing meaningful happening.

Judge only what is actually visible. Do not guess at what is behind a window, and do not describe the screen in detail.

Reply with exactly one line and nothing else, in this format:
category | short reason of at most twelve words`;

export const ACTIVITY_PROMPT =
  "Classify what the user is doing in this screenshot.";

export type DesktopAnalysis = {
  /** The parsed category, or null when the model answered in an unexpected shape. */
  category: ActivityCategory | null;
  /** The reason half of the line, e.g. "Browsing videos on YouTube." */
  note: string;
  /** The raw single line the model replied with. */
  text: string;
  /** The log the line was appended to. */
  path: string;
};

function parseCategory(text: string): ActivityCategory | null {
  const head = text.trim().split("|")[0]?.trim().toLowerCase();
  return ACTIVITY_CATEGORIES.find((category) => category === head) ?? null;
}

/**
 * The half of the verdict that says what is actually on screen.
 *
 * This is what the duck ends up talking about, so a line that arrived without
 * the expected separator falls back to the whole thing rather than to nothing.
 */
function parseNote(text: string): string {
  const [, ...rest] = text.split("|");
  return (rest.join("|").trim() || text.trim()).replace(/\s+/g, " ");
}

/** Appends one timestamped line to the analysis log. */
export function logNote(body: string): Promise<string> {
  // The log is one entry per line. The model is asked for a single line and an
  // error message is usually one, but neither is guaranteed, so anything that
  // wrapped gets folded back before it can break the shape of the file.
  const line = body.replace(/\s+/g, " ").trim();

  return invoke<string>("save_analysis", {
    text: `${new Date().toISOString()}  ${line}`,
  });
}

/**
 * Files a failure alongside the verdicts.
 *
 * The widget has no title bar and swallows right clicks, so its devtools are
 * effectively unreachable and a `console.error` there is invisible. Writing
 * failures to the same folder is the only way a broken run looks different from
 * a run that never happened.
 */
export function recordAnalysisFailure(error: unknown): Promise<string> {
  const detail = error instanceof Error ? error.message : String(error);
  return logNote(`FAILED: ${detail}`);
}

/**
 * Captures the desktop, asks Gemma what is going on, and files the answer.
 *
 * The screenshot never touches the disk -- Rust hands it over as base64 JPEG
 * and it lives only as long as the request. Only the verdict is kept.
 */
export async function analyseDesktop(): Promise<DesktopAnalysis> {
  const imageBase64 = await invoke<string>("capture_screen");

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    config: { systemInstruction: ACTIVITY_SYSTEM_PROMPT },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: ACTIVITY_PROMPT },
        ],
      },
    ],
  });

  const text = (response.text ?? "").trim();
  const path = await logNote(text);

  return { category: parseCategory(text), note: parseNote(text), text, path };
}
