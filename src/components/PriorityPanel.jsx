// PriorityPanel.jsx — side panel on the TASK board: every open task in one
// priority list. Move a task up or down with the arrows. Order is stored in
// the tasks table's existing "order" column (see App.jsx handlePriorityMove),
// so no database change is needed.
// Phone layout: the panel sits above the board, collapsed by default. Each task
// is one line; tap a line to expand it, then tap "Open task" for the full card.
import { useState } from 'react';
import '../styles/priority-panel.css';

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

export default function PriorityPanel({ tasks, onMove, onOpen, onToggleDone }) {
  const [panelOpen, setPanelOpen] = useState(() => !isPhone());
  const [expandedId, setExpandedId] = useState(null);
  const open = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => (a.order - b.order) || String(a.jobId).localeCompare(String(b.jobId)));

  function handleRow(id) {
    if (isPhone()) setExpandedId(cur => (cur === id ? null : id));
    else onOpen(id);
  }

  return (
    <aside className={`priority-panel${panelOpen ? '' : ' collapsed'}`} aria-label="Priority list">
      <button type="button" className="priority-head priority-toggle" onClick={() => setPanelOpen(o => !o)} aria-expanded={panelOpen}>
        <span>Priority list <span className="priority-caret">{panelOpen ? '▾' : '▸'}</span></span>
        <span className="count">{open.length}</span>
      </button>
      {panelOpen && <p className="priority-hint">Top = most urgent. Tap a task to expand it. Use the arrows to reorder.</p>}
      {panelOpen && open.length === 0 && <div className="empty-slot">No open tasks</div>}
      {panelOpen && (
        <ol className="priority-list">
          {open.map((t, i) => (
            <li key={t.id} className={`priority-item${expandedId === t.id ? ' expanded' : ''}`}>
              {onToggleDone && (
                <label className="done-check inline" title="Mark done">
                  <input type="checkbox" checked={false} onChange={() => onToggleDone(t.id)} aria-label="Mark done" />
                </label>
              )}
              <span className="priority-rank">{i + 1}</span>
              <button type="button" className="priority-body" onClick={() => handleRow(t.id)} title="Show task">
                <span className="priority-title">{t.fields?.title || '(untitled)'}</span>
                <span className="priority-meta">
                  {[t.assignedTo, t.fields?.dueDate ? `due ${t.fields.dueDate}` : ''].filter(Boolean).join(' · ')}
                </span>
                {expandedId === t.id && (
                  <span className="priority-open" role="button" tabIndex={0}
                    onClick={e => { e.stopPropagation(); onOpen(t.id); }}>Open task →</span>
                )}
              </button>
              <span className="priority-arrows">
                <button type="button" className="btn btn-quiet btn-sm" disabled={i === 0}
                  onClick={() => onMove(t.id, -1)} aria-label="Move up">▲</button>
                <button type="button" className="btn btn-quiet btn-sm" disabled={i === open.length - 1}
                  onClick={() => onMove(t.id, 1)} aria-label="Move down">▼</button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
