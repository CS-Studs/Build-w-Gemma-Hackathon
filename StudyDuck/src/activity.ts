import { ACTIVITY_CATEGORIES, type ActivityCategory } from "./screenAnalysis";

export type ActivityTotals = Record<ActivityCategory, number>;

export type ActivityState = {
  /** Category of the most recent reading, or null before one has been taken. */
  category: ActivityCategory | null;
  /** When the current unbroken run of that category began. */
  since: number;
  /** When the most recent reading was taken. */
  observedAt: number;
  /** Milliseconds spent in each category. */
  totals: ActivityTotals;
};

const STORAGE_KEY = "studyduck.activity.v1";

/**
 * Gaps longer than this are not credited to anything.
 *
 * Readings arrive every few seconds while the duck is watching, so a gap this
 * large means it was not: the timer was paused, or the window was swapped. What
 * the user did in the meantime is genuinely unknown, and guessing would quietly
 * inflate whichever category happened to be last.
 */
const MAX_CREDITED_GAP_MS = 30_000;

function emptyTotals(): ActivityTotals {
  return Object.fromEntries(
    ACTIVITY_CATEGORIES.map((category) => [category, 0]),
  ) as ActivityTotals;
}

function isTotals(value: unknown): value is ActivityTotals {
  if (typeof value !== "object" || value === null) return false;
  const totals = value as Record<string, unknown>;
  return ACTIVITY_CATEGORIES.every((category) => {
    const entry = totals[category];
    return typeof entry === "number" && Number.isFinite(entry) && entry >= 0;
  });
}

/**
 * The totals recorded so far, or fresh ones.
 *
 * Only the totals are persisted. The run in progress deliberately is not: on a
 * later launch its `since` would be hours stale, and the duck would read that
 * as the user having been off task the whole time.
 */
export function loadTotals(): ActivityTotals {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyTotals();
    const value: unknown = JSON.parse(raw);
    return isTotals(value) ? value : emptyTotals();
  } catch {
    return emptyTotals();
  }
}

export function saveTotals(totals: ActivityTotals): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(totals));
  } catch {
    // Storage being unavailable costs the history, not the running tally.
  }
}

export function emptyActivity(at: number = Date.now()): ActivityState {
  return { category: null, since: at, observedAt: at, totals: loadTotals() };
}

/**
 * Folds one reading into the running record.
 *
 * The gap since the previous reading is credited to the category that was in
 * force during it, not the one just observed: the user spent those seconds
 * doing the old thing, and only now is known to have switched.
 */
export function applyObservation(
  state: ActivityState,
  category: ActivityCategory,
  at: number,
): ActivityState {
  const totals = { ...state.totals };
  const gap = at - state.observedAt;

  if (state.category && gap > 0 && gap <= MAX_CREDITED_GAP_MS) {
    totals[state.category] += gap;
  }

  return {
    category,
    // An unbroken run of the same category keeps its original start, which is
    // what the duck's patience is measured against.
    since: state.category === category ? state.since : at,
    observedAt: at,
    totals,
  };
}

/**
 * Clears the run in progress but keeps the totals.
 *
 * Used when the duck starts or stops watching, so a stretch it could not see
 * never counts towards how long the user has been off task.
 */
export function restartRun(
  state: ActivityState,
  at: number = Date.now(),
): ActivityState {
  return { ...state, category: null, since: at, observedAt: at };
}
