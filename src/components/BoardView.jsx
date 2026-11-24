// BoardView.jsx — ported from public/js/board.js (columns + native HTML5
// drag-and-drop). Emits the same {status, beforeId, afterId} shape on drop
// that the original did; App.jsx resolves that into an order value.
import { useState } from 'react';
import JobCard from './JobCard.jsx';

function applyFilters(cards, filters, config) {
  const search = (filters.search || '').trim().toLowerCase();
  return cards.filter(c => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.bucket) {
      const closed = (config.closedStatuses || []);
      const today = new Date().toISOString().slice(0, 10);
      const due = c.fields?.dueDate;
      if (filters.bucket === 'open' && closed.includes(c.status)) return false;
      if (filters.bucket === 'outstanding' && ['paid', 'closed'].includes(c.status)) return false;
      if (filters.bucket === 'due_today' && (closed.includes(c.status) || due !== today)) return false;
      if (filters.bucket === 'overdue' && (closed.includes(c.status) || !due || due >= today)) return false;
      if (filters.bucket === 'paid_month' && !(c.status === 'paid' && (c.fields?.datePaid || '').startsWith(today.slice(0, 7)))) return false;
    }
    if (filters.priority && c.priority !== filters.priority) return false;
    if (filters.assignee && c.assignedTo !== filters.assignee) return false;
    if (filters.dueDate && c.fields?.dueDate !== filters.dueDate) return false;
    if (search) {
      const hay = [c.jobId, c.assignedTo, ...Object.values(c.fields || {})]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function getDropTarget(colEl, clientY, draggingId) {
  const els = [...colEl.querySelectorAll('.job-card')].filter(el => el.dataset.id !== draggingId);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return el;
  }
  return null;
}

export default function BoardView({ config, cards, filters, onCardClick, onCardMove, onQuickAdd }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const filtered = applyFilters(cards, filters, config);

  const itemLabel = config.itemLabel || 'job';

  if (!cards.length) {
    return (
      <main className="board-scroll" id="board-scroll">
        <div className="empty-board">
          <p>No {itemLabel}s yet. Create the first one to get started.</p>
          <button className="btn btn-primary" onClick={() => onQuickAdd(config.columns[0].id)}>+ New {itemLabel}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="board-scroll" id="board-scroll">
      <div className="column-headers">
        {config.columns.map(col => {
          const count = filtered.filter(c => c.status === col.id).length;
          return (
            <div className="col-head" key={col.id}>
              <span>{col.label}</span><span className="count">{count}</span>
            </div>
          );
        })}
      </div>

      {!filtered.length ? (
        <div className="empty-board"><p>No {itemLabel}s match the current filters.</p></div>
      ) : (
        <div className="board-columns">
          {config.columns.map(col => {
            const inCol = filtered.filter(c => c.status === col.id).sort((a, b) => a.order - b.order);
            return (
              <div
                key={col.id}
                className={`column-drop${dragOverCol === col.id ? ' drag-over' : ''}`}
                data-status={col.id}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.id); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const cardId = e.dataTransfer.getData('text/plain');
                  if (!cardId) return;
                  const colEl = e.currentTarget;
                  const beforeEl = getDropTarget(colEl, e.clientY, cardId);
                  const cardEls = [...colEl.querySelectorAll('.job-card')].filter(el => el.dataset.id !== cardId);
                  const beforeIdx = beforeEl ? cardEls.indexOf(beforeEl) : cardEls.length;
                  onCardMove(cardId, {
                    status: col.id,
                    beforeId: beforeEl ? beforeEl.dataset.id : undefined,
                    afterId: beforeIdx > 0 ? cardEls[beforeIdx - 1].dataset.id : undefined
                  });
                }}
              >
                {inCol.length
                  ? inCol.map(c => (
                    <JobCard
                      key={c.id} card={c} config={config}
                      dragging={draggingId === c.id}
                      onClick={() => onCardClick(c.id)}
                      onDragStart={e => { setDraggingId(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))
                  : <div className="empty-slot">drop here</div>}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
