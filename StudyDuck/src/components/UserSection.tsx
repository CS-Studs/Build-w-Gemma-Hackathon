import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

export function UserSection() {
  const [name, setName] = useState(loadUserName);
  const [draftName, setDraftName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      cardRef.current?.focus();
    };
  }, [modalOpen]);
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY) {
        const storedName = loadUserName();
        setName(storedName);
        setDraftName(storedName);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
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
    <section
      ref={cardRef}
      className="user-section"
      role="button"
      tabIndex={0}
      aria-label="Open user profile"
      aria-haspopup="dialog"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input")) return;
        setModalOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setModalOpen(true);
        }
      }}
    >
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
      {modalOpen &&
        createPortal(
          <div
            className="stats-modal__backdrop"
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) setModalOpen(false);
            }}
          >
            <section
              className="stats-modal user-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-modal-title"
              aria-describedby="user-modal-description"
            >
              <header className="stats-modal__header">
                <div>
                  <p className="stats-modal__eyebrow">Your profile</p>
                  <h2 id="user-modal-title">User</h2>
                  <p id="user-modal-description">
                    Your profile details will live here.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  className="stats-modal__close"
                  type="button"
                  aria-label="Close user profile"
                  onClick={() => setModalOpen(false)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </button>
              </header>
              <div className="stats-modal__body" />
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
