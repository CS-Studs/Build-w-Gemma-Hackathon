import { GoogleGenAI } from "@google/genai";

/** The one client the duck reaches Google through. */
export const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/**
 * Reads the screen and says what it makes of it, in a single call.
 *
 * A second model used to write the duck's lines from this one's verdict. Two
 * round trips meant the line always trailed the mood it belonged to, and the
 * second one spent its time queued behind the first one's screenshots. Asking
 * for the line in the same breath as the category costs nothing extra: the
 * model has already looked at the screen by the time it writes it.
 */
export const MODEL = "gemma-4-31b-it";
