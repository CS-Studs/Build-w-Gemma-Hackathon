import { useEffect, useState } from "react";
import {
  type ActiveStudySession,
  STUDY_SESSION_STORAGE_KEY,
  STUDY_SESSIONS_CHANGED_EVENT,
  loadStudySessions,
} from "../components/studySessionStore";

/**
 * The study session currently in the store, kept in step with it.
 *
 * A change reaches this window one of two ways and the store raises both: the
 * `storage` event when another document writes the key, and the custom event
 * for writes made in this window, which `storage` deliberately never fires for.
 * Listening to only one leaves a blind spot depending on where the click came
 * from, so both are handled.
 */
export function useActiveStudySession(): ActiveStudySession | null {
  const [active, setActive] = useState<ActiveStudySession | null>(
    () => loadStudySessions().active,
  );

  useEffect(() => {
    const reload = () => setActive(loadStudySessions().active);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STUDY_SESSION_STORAGE_KEY) reload();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_SESSIONS_CHANGED_EVENT, reload);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STUDY_SESSIONS_CHANGED_EVENT, reload);
    };
  }, []);

  return active;
}
