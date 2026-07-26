import { GoogleGenAI } from "@google/genai";

/** The one client the duck reaches Google through. */
export const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/** Reads the screen. Multimodal, and by far the slower of the two. */
export const VISION_MODEL = "gemma-4-31b-it";

/**
 * Writes the duck's lines.
 *
 * Deliberately the smaller model: a remark is a dozen words of text with no
 * image attached, and it has to land while the mood it belongs to is still on
 * screen. Accuracy matters far less here than answering quickly.
 */
export const SPEECH_MODEL = "gemma-4-31b-it";
