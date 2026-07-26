import { type KeyboardEvent, useEffect, useState } from "react";
import {
  type CompletedStudySession,
  type StoredStudySessions,
  STUDY_SESSIONS_CHANGED_EVENT,
  STUDY_SESSION_STORAGE_KEY,
  loadStudySessions,
} from "./studySessionStore";
import "./UserSection.css";

type StoredUserProfile = {
  version: 1;
  name: string;
};

const PROFILE_STORAGE_KEY = "studyduck.user-profile.v1";
const DEFAULT_NAME = "Student";

function loadUserName(): string {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_NAME;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_NAME;
    const profile = value as StoredUserProfile;
    if (
      profile.version !== 1 ||
      typeof profile.name !== "string" ||
      !profile.name.trim()
    ) {
      return DEFAULT_NAME;
    }
    return profile.name.trim();
  } catch {
    return DEFAULT_NAME;
  }
}

function saveUserName(name: string): void {
  const profile: StoredUserProfile = { version: 1, name };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // The edited name still remains available for the current window.
  }
}

function formatTotalStudyTime(history: CompletedStudySession[]): string {
  const totalMs = history.reduce(
    (total, session) => total + session.durationMs,
    0,
  );
  const totalMinutes = Math.floor(totalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function UserSection() {
  const [name, setName] = useState(loadUserName);
  const [draftName, setDraftName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<CompletedStudySession[]>(
    () => loadStudySessions().history,
  );

  useEffect(() => {
    const handleSessionChange = (event: Event) => {
      const sessions = (event as CustomEvent<StoredStudySessions>).detail;
      setHistory(sessions.history);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STUDY_SESSION_STORAGE_KEY) {
        setHistory(loadStudySessions().history);
      }
      if (event.key === PROFILE_STORAGE_KEY) {
        const storedName = loadUserName();
        setName(storedName);
        setDraftName(storedName);
      }
    };

    window.addEventListener(STUDY_SESSIONS_CHANGED_EVENT, handleSessionChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        STUDY_SESSIONS_CHANGED_EVENT,
        handleSessionChange,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const beginEditing = () => {
    setDraftName(name);
    setEditing(true);
  };

  const saveEditing = () => {
    const cleanName = draftName.trim();
    if (cleanName) {
      setName(cleanName);
      setDraftName(cleanName);
      saveUserName(cleanName);
    } else {
      setDraftName(name);
    }
    setEditing(false);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraftName(name);
      setEditing(false);
    }
  };

  return (
    <section className="user-section" aria-label="User summary">
      <div className="user-section__identity">
        <p className="user-section__eyebrow">Student</p>
        {editing ? (
          <input
            className="user-section__name-input"
            value={draftName}
            maxLength={60}
            aria-label="User name"
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={saveEditing}
            onKeyDown={handleNameKeyDown}
          />
        ) : (
          <button
            className="user-section__name"
            type="button"
            title="Edit name"
            onClick={beginEditing}
          >
            {name}
          </button>
        )}
      </div>

      <div className="user-section__total" aria-live="polite">
        <strong>{formatTotalStudyTime(history)}</strong>
        <span>Total studied</span>
      </div>
    </section>
  );
}
