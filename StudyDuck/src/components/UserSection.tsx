import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type AccountabilityTone,
  type GuidanceStyle,
  type ResponseDetail,
  type UserProfile,
  USER_PROFILE_CHANGED_EVENT,
  USER_PROFILE_STORAGE_KEY,
  loadUserProfile,
  saveUserProfile,
} from "./userProfileStore";
import "./UserSection.css";

const cloneProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  preferences: { ...profile.preferences },
});

export function UserSection() {
  const [profile, setProfile] = useState(loadUserProfile);
  const [draft, setDraft] = useState<UserProfile>(() => cloneProfile(profile));
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [modalOpen, setModalOpen] = useState(false);
  const [nameError, setNameError] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  dirtyRef.current = dirty;

  const openModal = () => {
    setDraft(cloneProfile(profile));
    setNameError(false);
    setModalOpen(true);
  };
  const closeModal = (confirmDirty = true) => {
    if (confirmDirty && dirtyRef.current && !window.confirm("Discard your unsaved personalization changes?")) return;
    setModalOpen(false);
  };

  useEffect(() => {
    const profileChange = (event: Event) => {
      const next = (event as CustomEvent<UserProfile>).detail;
      setProfile(next);
      setDraftName(next.name);
      if (!modalOpen) setDraft(cloneProfile(next));
    };
    const storageChange = (event: StorageEvent) => {
      if (event.key !== USER_PROFILE_STORAGE_KEY) return;
      const next = loadUserProfile();
      setProfile(next);
      setDraftName(next.name);
      if (!modalOpen) setDraft(cloneProfile(next));
    };
    window.addEventListener(USER_PROFILE_CHANGED_EVENT, profileChange);
    window.addEventListener("storage", storageChange);
    return () => {
      window.removeEventListener(USER_PROFILE_CHANGED_EVENT, profileChange);
      window.removeEventListener("storage", storageChange);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => firstInputRef.current?.focus());
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keyDown);
      cardRef.current?.focus();
    };
  }, [modalOpen]);

  const saveInlineName = () => {
    const name = draftName.trim();
    if (name) saveUserProfile({ ...profile, name });
    else setDraftName(profile.name);
    setEditing(false);
  };
  const inlineNameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setDraftName(profile.name); setEditing(false); }
  };

  const savePersonalization = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) { setNameError(true); firstInputRef.current?.focus(); return; }
    const saved: UserProfile = {
      ...draft,
      name,
      about: draft.about.trim(),
      goals: draft.goals.trim(),
      struggles: draft.struggles.trim(),
      accomplishments: draft.accomplishments.trim(),
      customInstructions: draft.customInstructions.trim(),
      preferences: { ...draft.preferences },
    };
    dirtyRef.current = false;
    setProfile(saved);
    setDraft(saved);
    setDraftName(saved.name);
    saveUserProfile(saved);
    setModalOpen(false);
  };

  const textArea = (key: "about" | "goals" | "struggles" | "accomplishments" | "customInstructions", label: string, hint: string, maximum = 1_000) => (
    <label className="user-profile__field">
      <span>{label}</span>
      <small>{hint}</small>
      <textarea value={draft[key]} maxLength={maximum} rows={4} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
      <em>{draft[key].length}/{maximum}</em>
    </label>
  );

  return (
    <section ref={cardRef} className="user-section" role="button" tabIndex={0} aria-label="Open DuckChat personalization" aria-haspopup="dialog"
      onClick={(event) => { if (!(event.target as HTMLElement).closest("button, input")) openModal(); }}
      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openModal(); } }}>
      <div className="user-section__identity">
        <p className="user-section__eyebrow">Student</p>
        {editing ? <input className="user-section__name-input" value={draftName} maxLength={60} aria-label="User name" autoFocus onChange={(event) => setDraftName(event.target.value)} onBlur={saveInlineName} onKeyDown={inlineNameKey} />
          : <button className="user-section__name" type="button" title="Edit name" onClick={() => { setDraftName(profile.name); setEditing(true); }}>{profile.name}</button>}
      </div>

      {modalOpen && createPortal(
        <div className="stats-modal__backdrop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) closeModal(); }}>
          <section ref={modalRef} className="stats-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title" aria-describedby="user-modal-description">
            <header className="stats-modal__header">
              <div><p className="stats-modal__eyebrow">Your profile</p><h2 id="user-modal-title">Personalize your DuckChat</h2><p id="user-modal-description">Help your study partner understand how to support you.</p></div>
              <button className="stats-modal__close" type="button" aria-label="Close personalization" onClick={() => closeModal()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
            </header>
            <form className="user-profile" onSubmit={savePersonalization}>
              <div className="user-profile__content">
                <div className="user-profile__notice"><strong>Private to this device</strong><span>Your profile is stored locally and included in Gemma requests only when you use DuckChat.</span></div>
                <section className="user-profile__section"><header><h3>About you</h3><p>Give DuckChat context that helps it make support relevant.</p></header>
                  <label className="user-profile__field"><span>Your name</span><small>How DuckChat should address you.</small><input ref={firstInputRef} value={draft.name} maxLength={60} aria-invalid={nameError} onChange={(event) => { setNameError(false); setDraft((current) => ({ ...current, name: event.target.value })); }} />{nameError && <b>Please enter a name.</b>}</label>
                  <div className="user-profile__grid">{textArea("about", "About me", "Your background, interests, studies, or circumstances.")}{textArea("goals", "Long-term goals", "The bigger outcomes you are working toward.")}{textArea("struggles", "Challenges and struggles", "Patterns, blockers, or situations that make progress difficult.")}{textArea("accomplishments", "What I want to accomplish", "The results you most want DuckChat to help you reach.")}</div>
                </section>
                <section className="user-profile__section"><header><h3>Chat preferences</h3><p>Choose how DuckChat should guide and hold you accountable.</p></header>
                  <div className="user-profile__selects">
                    <label><span>Accountability tone</span><select value={draft.preferences.tone} onChange={(event) => setDraft((current) => ({ ...current, preferences: { ...current.preferences, tone: event.target.value as AccountabilityTone } }))}><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="firm">Firm</option></select></label>
                    <label><span>Response detail</span><select value={draft.preferences.detail} onChange={(event) => setDraft((current) => ({ ...current, preferences: { ...current.preferences, detail: event.target.value as ResponseDetail } }))}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label>
                    <label><span>Guidance style</span><select value={draft.preferences.guidance} onChange={(event) => setDraft((current) => ({ ...current, preferences: { ...current.preferences, guidance: event.target.value as GuidanceStyle } }))}><option value="questions-first">Questions first</option><option value="balanced">Balanced</option><option value="explanation-first">Explanation first</option></select></label>
                  </div>
                  {textArea("customInstructions", "Additional instructions", "Optional preferences that do not fit above. Core tutoring behavior always takes priority.", 1_500)}
                </section>
              </div>
              <footer className="user-profile__footer"><span>{dirty ? "Unsaved changes" : "No unsaved changes"}</span><div><button className="user-profile__cancel" type="button" onClick={() => closeModal(false)}>Cancel</button><button className="user-profile__save" type="submit" disabled={!draft.name.trim() || !dirty}>Save changes</button></div></footer>
            </form>
          </section>
        </div>, document.body)}
    </section>
  );
}
