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
          <div className="topbar-title"><i className="ti ti-notes"></i> {screen.name}</div>
        </div>
        <div className="view"><div className="empty-state" style={{ height: '60vh' }}>Loading...</div></div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="topbar">
        <div className="topbar-title">
          <i className="ti ti-notes" style={{ color: 'var(--text-2)' }}></i> {screen.name}
        </div>
        <div className="topbar-actions">
          <button className="pill-btn primary" onClick={handleAddNote}>
            <i className="ti ti-plus"></i> New note
          </button>
        </div>
      </div>
      <div className="view">
        <div className="view-inner">
          {notes.length === 0 && (
            <div className="empty-state" style={{ height: '50vh' }}>
              <i className="ti ti-notes"></i>
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
                  <i className="ti ti-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
