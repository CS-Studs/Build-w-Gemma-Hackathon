import React, { useState, useEffect } from 'react';
import './Notes.css';

export function Notes() {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Load notes from local storage when the component mounts
  useEffect(() => {
    const savedNotes = localStorage.getItem('studyduck-notes');
    if (savedNotes) {
      setNoteText(savedNotes);
    }
  }, []);

  // Save notes to local storage whenever they change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNoteText(text);
    localStorage.setItem('studyduck-notes', text);
  };

  return (
    <>
      {/* Grid Pane Trigger */}
      <div
        className="workspace__pane tool-trigger notes-trigger"
        onClick={() => setIsOpen(true)}
      >
        <div className="tool-icon">📝</div>
        <h3>Notes</h3>
        <p>Jot down quick thoughts</p>
      </div>

      {/* Fullscreen Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="modal-content notes-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Notes</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* The Notepad Area */}
            <div className="notes-container">
              <textarea
                className="notes-textarea"
                placeholder="Start typing your notes here..."
                value={noteText}
                onChange={handleTextChange}
                autoFocus
              />
            </div>

            <div className="modal-controls">
              <span className="save-indicator">
                {noteText.length > 0 ? '✓ Saved locally' : ''}
              </span>
              <button
                className="action-btn primary"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
