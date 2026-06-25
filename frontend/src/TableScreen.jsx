import React, { useState, useEffect } from 'react';
import { api } from './api.js';

export default function TableScreen({ screen }) {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.getTable(screen.id);
    setColumns(data.columns);
    setRows(data.rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [screen.id]);

  async function handleAddColumn() {
    await api.addColumn(screen.id, 'New column');
    load();
  }

  async function handleRenameColumn(columnId, name) {
    setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, column_name: name } : c)));
    await api.renameColumn(columnId, name);
  }

  async function handleDeleteColumn(columnId) {
    await api.deleteColumn(columnId);
    load();
  }

  async function handleCellEdit(rowId, columnId, value) {
    setRows((rs) =>
      rs.map((r) => (r.id === rowId ? { ...r, row_data: { ...r.row_data, [columnId]: value } } : r))
    );
    await api.updateRow(rowId, { [columnId]: value });
  }

  async function handleAddRow() {
    await api.addRow(screen.id, {});
    load();
  }

  async function handleDeleteRow(rowId) {
    await api.deleteRow(rowId);
    load();
  }

  if (loading) {
    return (
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">
            <i className="ti ti-table" style={{ color: 'var(--text-2)' }}></i> {screen.name}
          </div>
        </div>
        <div className="view"><div className="empty-state" style={{ height: '60vh' }}>Loading...</div></div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="topbar">
        <div className="topbar-title">
          <i className="ti ti-table" style={{ color: 'var(--text-2)' }}></i> {screen.name}
        </div>
        <div className="topbar-actions">
          <button className="pill-btn" onClick={load}>
            <i className="ti ti-refresh"></i> Reload
          </button>
        </div>
      </div>
      <div className="view">
        <div className="view-inner">
          <div className="screen-header">
            <div className="meta">{rows.length} row{rows.length === 1 ? '' : 's'}</div>
          </div>

          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.id}>
                    <span
                      className="editable-th"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleRenameColumn(col.id, e.target.textContent)}
                    >
                      {col.column_name}
                    </span>
                    <button className="col-delete" onClick={() => handleDeleteColumn(col.id)} title="Delete column">
                      <i className="ti ti-x"></i>
                    </button>
                  </th>
                ))}
                <th className="add-col-th">
                  <button className="add-col-btn" onClick={handleAddColumn} title="Add column">
                    <i className="ti ti-plus"></i>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleCellEdit(row.id, col.id, e.target.textContent)}
                    >
                      {row.row_data[col.id] || ''}
                    </td>
                  ))}
                  <td className="add-col-spacer">
                    <button className="col-delete" style={{ opacity: 1, position: 'static' }} onClick={() => handleDeleteRow(row.id)} title="Delete row">
                      <i className="ti ti-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="add-row-btn" onClick={handleAddRow}>
            <i className="ti ti-plus"></i> Add row
          </button>

          <div className="table-footer-hint">
            <i className="ti ti-pencil"></i>
            Click any cell or header to edit directly — or tell the assistant in chat and ask it to refresh this screen.
          </div>
        </div>
      </div>
    </div>
  );
}
