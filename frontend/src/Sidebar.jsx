import React, { useState } from 'react';

export default function Sidebar({ screens, activeView, onSelectChat, onSelectScreen, onCreateScreen, onDeleteScreen, onLogout }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('table');

  function submitCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateScreen(newName.trim(), newType);
    setNewName('');
    setNewType('table');
    setCreating(false);
  }

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark">V</div>
        <div className="brand-name">Vault</div>
      </div>

      <div className={`nav-item ${activeView === 'chat' ? 'active' : ''}`} onClick={onSelectChat}>
        <i className="ti ti-message-circle"></i>
        <span>Chat</span>
      </div>

      <div className="nav-section-label">Your screens</div>

      {screens.map((s) => (
        <div
          key={s.id}
          className={`screen-slot ${activeView === s.id ? 'active' : ''}`}
          onClick={() => onSelectScreen(s)}
        >
          <span className="slot-dot"></span>
          <div className="slot-meta">
            <div className="slot-name">{s.name}</div>
            <div className="slot-type">{s.type}</div>
          </div>
          <button
            className="slot-delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete screen "${s.name}"? This can't be undone.`)) onDeleteScreen(s.id);
            }}
            title="Delete screen"
          >
            <i className="ti ti-trash"></i>
          </button>
        </div>
      ))}

      {creating ? (
        <form onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <input
            autoFocus
            placeholder="Screen name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6,
              padding: '7px 9px', color: 'var(--text-0)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6,
              padding: '7px 9px', color: 'var(--text-0)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
            }}
          >
            <option value="table">Table</option>
            <option value="notes">Notes</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="pill-btn primary" style={{ flex: 1, justifyContent: 'center' }}>Create</button>
            <button type="button" className="pill-btn" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="new-screen-btn" onClick={() => setCreating(true)}>
          <i className="ti ti-plus"></i>
          <span>New screen</span>
        </button>
      )}

      <div className="sidebar-footer">
        <span className="footer-dot"></span>
        <span>Memory always on</span>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        <i className="ti ti-logout"></i> Log out
      </button>
    </div>
  );
}
