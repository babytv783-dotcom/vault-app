import React, { useState, useEffect } from 'react';
import { api } from './api.js';

export default function NotesScreen({ screen }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setNotes(await api.getNotes(screen.id));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [screen.id]);

  async function handleAddNote() {
    await api.addNote(screen.id, 'New note', '');
    load();
  }

  async function handleEditTitle(noteId, title) {
    setNotes((ns) => ns.map((n) => (n.id === noteId ? { ...n, title } : n)));
    await api.updateNote(noteId, title, null);
  }

  async function handleEditBody(noteId, body) {
    setNotes((ns) => ns.map((n) => (n.id === noteId ? { ...n, body } : n)));
    await api.updateNote(noteId, null, body);
  }

  async function handleDelete(noteId) {
    await api.deleteNote(noteId);
    load();
  }

  if (loading) {
    return (
      <div className="main">
        <div className="topbar">
          <div className="topbar-title"><span className="icon-glyph">&#9776;</span> {screen.name}</div>
        </div>
        <div className="view"><div className="empty-state" style={{ height: '60vh' }}>Loading...</div></div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="topbar">
        <div className="topbar-title">
          <span className="icon-glyph" style={{ color: 'var(--text-2)' }}>&#9776;</span> {screen.name}
        </div>
        <div className="topbar-actions">
          <button className="pill-btn primary" onClick={handleAddNote}>
            <span className="icon-glyph">+</span> New note
          </button>
        </div>
      </div>
      <div className="view">
        <div className="view-inner">
          {notes.length === 0 && (
            <div className="empty-state" style={{ height: '50vh' }}>
              <span className="icon-glyph" style={{ fontSize: 28 }}>&#9776;</span>
              <div>No notes yet — click "New note" to add one.</div>
            </div>
          )}
          {notes.map((note) => (
            <div className="note-card" key={note.id}>
              <div
                className="note-title"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditTitle(note.id, e.target.textContent)}
              >
                {note.title || 'Untitled'}
              </div>
              <div
                className="note-body"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditBody(note.id, e.target.textContent)}
              >
                {note.body}
              </div>
              <div className="note-meta">
                <span>{new Date(note.updated_at).toLocaleDateString()} · editable</span>
                <button className="note-delete" onClick={() => handleDelete(note.id)}>
                  <span className="icon-glyph">&#10005;</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
