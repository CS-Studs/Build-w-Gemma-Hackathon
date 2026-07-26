import { invoke } from "@tauri-apps/api/core";
import { ai, MODEL } from "./gemma";

/** The three buckets a screenshot can fall into. */
export const ACTIVITY_CATEGORIES = ["work", "entertainment", "desktop"] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/**
 * One prompt, two jobs: sort the screen, and say the thing about it.
 *
 * The line is asked for in the same reply as the category because the model has
 * already looked at the screen by then. Splitting it out meant a second round
 * trip that could only ever finish after the duck's face had already changed.
 */
export const ACTIVITY_SYSTEM_PROMPT = `You are StudyDuck: a small rubber duck that sits on a student's desktop and watches their screen while their study timer runs.

From a single screenshot, decide what they are doing. Choose exactly one category:
- work: studying, reading, writing, coding, research, documents, email, spreadsheets, lecture material.
- entertainment: video, streaming, games, social media, shopping, chat that is clearly not study related.
- desktop: an empty or near-empty desktop, a lock screen, a screensaver, a file manager, settings, or nothing meaningful happening.

Judge only what is actually visible. Do not guess at what is behind a window.

Then write the single line the duck says out loud about it.

Rules for the line:
- One sentence, at most twelve words. It has to fit in a tiny speech bubble.
- Talk straight to the student as "you". Never narrate in the third person.
- Name the specific thing you can see them doing.
- If they are working, be warm and encouraging.
- If they are not, be disappointed and send them back to work, but stay light. Never insult them.
- Plain text only. No quotation marks, no emoji, no markdown.

Reply with exactly one line and nothing else, in this format:
category | the duck's line

For example:
work | Great work on your hackathon project!
entertainment | Stop browsing videos and get back to work!`;

const ACTIVITY_PROMPT = "What is the user doing, and what do you say to them?";

/**
 * The user turn, told how long this has been going on.
 *
 * The duck used to get this for free, because the model that wrote its lines
 * was handed the elapsed time separately. Now that there is only one call it
 * has to travel with the screenshot, or the duck loses its sense of how long
 * someone has been at something and every line reads like the first.
 */
function buildPrompt(elapsedMs: number | null): string {
  const minutes = elapsedMs === null ? 0 : Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return ACTIVITY_PROMPT;

  const howLong = minutes === 1 ? "a minute" : `${minutes} minutes`;
  return `${ACTIVITY_PROMPT}
They have been on this same kind of thing for ${howLong} now, so say something about that.`;
}

export type DesktopAnalysis = {
  /** The parsed category, or null when the model answered in an unexpected shape. */
  category: ActivityCategory | null;
  /** The duck's half of the line, e.g. "Stop browsing videos and get back to work!" */
  line: string;
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
 * The half of the verdict the duck says out loud.
 *
 * A reply that arrived without the expected separator falls back to the whole
 * thing rather than to nothing: a slightly odd bubble beats a silent duck.
 */
function parseLine(text: string): string {
  const [, ...rest] = text.split("|");
  return (rest.join("|").trim() || text.trim())
    .replace(/\s+/g, " ")
    .replace(/^["'*_\s]+|["'*_\s]+$/g, "");
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
 * Captures the desktop, asks Gemma what is going on and what to say about it,
 * and files the answer.
 *
 * The screenshot never touches the disk -- Rust hands it over as base64 JPEG
 * and it lives only as long as the request. Only the verdict is kept.
 *
 * `elapsedMs` is how long the user has been on the current sort of thing, or
 * null before anything is known.
 */
export async function analyseDesktop(
  elapsedMs: number | null,
): Promise<DesktopAnalysis> {
  const imageBase64 = await invoke<string>("capture_screen");

  const response = await ai.models.generateContent({
    model: MODEL,
    config: { systemInstruction: ACTIVITY_SYSTEM_PROMPT },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: buildPrompt(elapsedMs) },
        ],
      },
    ],
  });

  const text = (response.text ?? "").trim();
  const path = await logNote(text);

  return { category: parseCategory(text), line: parseLine(text), text, path };
}
