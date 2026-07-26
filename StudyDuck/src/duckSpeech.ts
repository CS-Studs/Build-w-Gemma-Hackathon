import { ai, SPEECH_MODEL } from "./gemma";
import type { ActivityCategory } from "./screenAnalysis";

const SPEECH_SYSTEM_PROMPT = `You are StudyDuck: a small rubber duck that sits on a student's desktop and watches their screen while their study timer runs.

You write the single line that goes in the duck's speech bubble.

Rules:
- One sentence, at most twelve words. It has to fit in a tiny bubble.
- Talk straight to the student as "you". Never narrate in the third person.
- Name the specific thing they are doing, using the words you are given for it.
- If they are studying or working, be warm and encouraging.
- If they are not, be disappointed and nudge them back, but stay light. Never insult them.
- Plain text only. No quotation marks, no emoji, no markdown, no explanation.

Reply with the line and nothing else.`;

/** How the duck refers to each category out loud. */
const DOING: Record<ActivityCategory, string> = {
  work: "studying",
  entertainment: "messing about with entertainment",
  desktop: "sitting on an idle desktop",
};

export type Remark = {
  /** The category of the stretch being commented on. */
  category: ActivityCategory;
  /** What they were doing before it, or null if the duck has only just started looking. */
  previous: ActivityCategory | null;
  /** What the screen showed on the most recent reading. */
  note: string;
  /** How long this stretch has run. Zero means the duck is reacting to the change itself. */
  elapsedMs: number;
};

/** Rounds to whole minutes, which is the only precision worth speaking aloud. */
function howLong(elapsedMs: number): string {
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000));
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

function buildPrompt({ category, previous, note, elapsedMs }: Remark): string {
  const situation =
    elapsedMs > 0
      ? `They have been ${DOING[category]} for ${howLong(elapsedMs)} now.`
      : previous
        ? `They have just switched from ${DOING[previous]} to ${DOING[category]}.`
        : `They have just started, and they are ${DOING[category]}.`;

  return `${situation}
On screen right now: ${note}

Write the duck's line.`;
}

/**
 * Strips the wrapping models like to add.
 *
 * A twelve-word instruction is usually obeyed, but "Sure! Here you go:" and a
 * pair of quotes turn up often enough that they are worth removing rather than
 * letting them reach the bubble, which has room for neither.
 */
function tidy(reply: string): string {
  const first = reply
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.endsWith(":"));

  return (first ?? "").replace(/^["'*_\s]+|["'*_\s]+$/g, "").trim();
}

/**
 * How long to wait for a line before giving up on it.
 *
 * A remark is only wanted while the mood it belongs to is still on screen, so a
 * slow one is worth abandoning: the duck can ask again with a fresher note. The
 * request that never comes back at all is the real reason for this, though --
 * without a deadline it would hold the duck's only voice open indefinitely.
 */
const SPEECH_TIMEOUT_MS = 25_000;

export type Remarked = {
  /** The line to show, or empty when nothing usable came back. */
  text: string;
  /**
   * Why it is empty, for the log.
   *
   * "The model replied with nothing" covers several quite different failures --
   * a truncated answer, a refusal, an empty candidate -- and telling them apart
   * from the outside is guesswork, so the reason travels with the result.
   */
  why: string;
};

/**
 * Asks Gemma for one line of duck.
 *
 * Stateless, like the screen classifier: every remark carries its own situation,
 * so there is no history to keep and nothing to go stale between sessions.
 */
export async function composeRemark(remark: Remark): Promise<Remarked> {
  const abort = new AbortController();
  const deadline = window.setTimeout(() => abort.abort(), SPEECH_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: SPEECH_MODEL,
      config: {
        systemInstruction: SPEECH_SYSTEM_PROMPT,
        // No maxOutputTokens, deliberately.
        //
        // The model thinks before it answers, thoughts are spent from the
        // output budget, and the SDK discards them when reading the reply. Any
        // cap is therefore a cap on the thinking, and the model runs out mid
        // thought and returns finish=MAX_TOKENS with nothing in it -- observed
        // at both 64 and 256. Turning the thinking off instead is refused:
        // "Thinking budget is not supported for this model". The prompt asks
        // for twelve words and that is the only limit that works.
        abortSignal: abort.signal,
      },
      contents: [{ role: "user", parts: [{ text: buildPrompt(remark) }] }],
    });

    const raw = response.text ?? "";
    const text = tidy(raw);
    if (text) return { text, why: "" };

    const finish = response.candidates?.[0]?.finishReason ?? "none";
    return {
      text: "",
      why: `finish=${finish} reply=${JSON.stringify(raw.slice(0, 120))}`,
    };
  } catch (error) {
    // The SDK does not hand our signal to fetch. It listens on ours and aborts
    // one of its own with no reason attached, so a request that ran out of time
    // surfaces as the browser's generic "signal is aborted without reason" and
    // reads like a bug in the client. Ours is the only deadline in play, so the
    // signal itself is enough to say what happened.
    if (abort.signal.aborted) {
      throw new Error(`no reply within ${SPEECH_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(deadline);
  }
}
