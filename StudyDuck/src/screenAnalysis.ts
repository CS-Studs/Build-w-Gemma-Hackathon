import { GoogleGenAI } from "@google/genai";
import { invoke } from "@tauri-apps/api/core";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/** Same model DuckChat talks to. */
const MODEL = "gemma-4-31b-it";

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
  /** The raw single line the model replied with. */
  text: string;
  /** Where the note was written. */
  path: string;
};

function parseCategory(text: string): ActivityCategory | null {
  const head = text.trim().split("|")[0]?.trim().toLowerCase();
  return ACTIVITY_CATEGORIES.find((category) => category === head) ?? null;
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
    model: MODEL,
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
  const path = await invoke<string>("save_analysis", {
    text: `${new Date().toISOString()}\n${text}\n`,
  });

  return { category: parseCategory(text), text, path };
}
