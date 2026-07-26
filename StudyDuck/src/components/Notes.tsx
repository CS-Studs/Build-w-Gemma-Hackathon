import React, { useState, useEffect } from 'react';
import './Notes.css';

// Define what a single note looks like
interface Note {
  id: string;
  title: string;
  content: string;
}

export function Notes() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Load notes from local storage when the component mounts
  useEffect(() => {
    const savedNotes = localStorage.getItem('studyduck-notes-list');
    if (savedNotes) {
      try {
        const parsed = JSON.parse(savedNotes);
        setNotes(parsed);
        // Automatically open the first note if it exists
        if (parsed.length > 0) {
          setActiveNoteId(parsed[0].id);
        }
      } catch (e) {
        console.error('Could not parse saved notes', e);
      }
    }
  }, []);

  // Save notes to local storage whenever the notes array changes
  useEffect(() => {
    localStorage.setItem('studyduck-notes-list', JSON.stringify(notes));
  }, [notes]);

  // Create a new note
  const handleCreateNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  // Delete a note
  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the click from selecting the note
    const updatedNotes = notes.filter((n) => n.id !== id);
    setNotes(updatedNotes);

    // If we deleted the active note, switch to another one or null
    if (activeNoteId === id) {
      setActiveNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
    }
  };

  // Update the currently active note (Explicitly pass the ID to avoid stale closures)
  const updateActiveNote = (id: string, updates: Partial<Note>) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    );
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);

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

            {/* The Layout (Sidebar + Editor) */}
            <div className="notes-layout">
              {/* Sidebar */}
              <div className="notes-sidebar">
                <button
                  className="action-btn primary full-width"
                  onClick={handleCreateNote}
                >
                  + New Note
                </button>
                <div className="notes-list">
                  {notes.length === 0 ? (
                    <p className="empty-notes-hint">No notes yet.</p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className={`note-list-item ${activeNoteId === note.id ? 'active' : ''}`}
                        onClick={() => setActiveNoteId(note.id)}
                      >
                        <span className="note-title-truncate">
                          {note.title || 'Untitled Note'}
                        </span>
                        <button
                          className="delete-note-btn"
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Delete note"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="notes-editor-area">
                {activeNote ? (
                  <>
                    <input
                      className="note-title-input"
                      placeholder="Note Title..."
                      value={activeNote.title}
                      onChange={(e) =>
                        updateActiveNote(activeNote.id, {
                          title: e.target.value,
                        })
                      }
                    />
                    <textarea
                      className="notes-textarea"
                      placeholder="Start typing your notes here..."
                      value={activeNote.content}
                      onChange={(e) =>
                        updateActiveNote(activeNote.id, {
                          content: e.target.value,
                        })
                      }
                      autoFocus
                    />
                  </>
                ) : (
                  <div className="empty-editor-state">
                    <span className="placeholder-icon">📝</span>
                    <p>Select a note or create a new one.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-controls">
              <span className="save-indicator">
                {activeNote ? '✓ Auto-saved' : ''}
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
