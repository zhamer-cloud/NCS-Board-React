// PriorityPanel.jsx — side panel on the TASK board: every open task in one
// priority list. Move a task up or down with the arrows. Order is stored in
// the tasks table's existing "order" column (see App.jsx handlePriorityMove),
// so no database change is needed.
import '../styles/priority-panel.css';

export default function PriorityPanel({ tasks, onMove, onOpen }) {
  const open = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => (a.order - b.order) || String(a.jobId).localeCompare(String(b.jobId)));

  return (
    <aside className="priority-panel" aria-label="Priority list">
      <div className="priority-head">
        <span>Priority list</span>
        <span className="count">{open.length}</span>
      </div>
      <p className="priority-hint">Top = most urgent. Use the arrows to reorder.</p>
      {open.length === 0 && <div className="empty-slot">No open tasks</div>}
      <ol className="priority-list">
        {open.map((t, i) => (
          <li key={t.id} className="priority-item">
            <span className="priority-rank">{i + 1}</span>
            <button type="button" className="priority-body" onClick={() => onOpen(t.id)} title="Open task">
              <span className="priority-title">{t.fields?.title || '(untitled)'}</span>
              <span className="priority-meta">
                {[t.assignedTo, t.fields?.dueDate ? `due ${t.fields.dueDate}` : ''].filter(Boolean).join(' · ')}
              </span>
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
    </aside>
  );
}
