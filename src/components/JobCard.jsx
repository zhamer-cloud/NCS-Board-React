// JobCard.jsx — ported from the cardHtml() renderer in public/js/board.js.
import { formatDateShort, isOverdue } from '../lib/utils.js';

function prioMeta(cfg, id) {
  return cfg.priorities.find(p => p.id === id) || { id, label: id };
}

function jobIdClass(jobId) {
  if (!jobId) return '';
  return jobId.split('-')[0].toLowerCase(); // 'app','est','pay'
}

export default function JobCard({ card, config, dragging, onClick, onDragStart, onDragEnd }) {
  const prio = prioMeta(config, card.priority);
  const title = (card.fields && card.fields[config.titleField]) || '(no title)';
  const allDefs = config.fieldGroups.flatMap(g => g.fields);

  const previewLines = (config.cardPreviewFields || [])
    .filter(k => k !== 'linkedAppraisalId' && k !== 'linkedEstimateId')
    .map(k => {
      const def = allDefs.find(f => f.key === k);
      const val = card.fields?.[k];
      if (!val) return null;
      return (
        <div className="meta-line" key={k}>
          <span className="k">{def ? def.label : k}:</span> {val}
        </div>
      );
    })
    .filter(Boolean);

  const linkedBadges = ['linkedAppraisalId', 'linkedEstimateId']
    .filter(k => card.fields?.[k])
    .map(k => <span className="linked-id-badge" key={k}>↗ {card.fields[k]}</span>);

  const isTaskBoard = config.id === 'task';
  const dueDate = card.fields?.dueDate;
  const overdue = isTaskBoard && isOverdue(dueDate, card.status, 'completed');

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  }

  return (
    <div
      className={`job-card prio-${prio.id}${dragging ? ' dragging' : ''}`}
      draggable="true"
      data-id={card.id}
      tabIndex={0}
      role="button"
      aria-label={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {card.jobId && <div className={`job-id-badge ${jobIdClass(card.jobId)}`}>{card.jobId}</div>}
      <div className="address">{title}</div>
      {previewLines}
      <div className="tags">
        <span className={`badge badge-${prio.id}`}>{prio.label}</span>
        {card.assignedTo && <span className="badge badge-assignee">{card.assignedTo}</span>}
        {isTaskBoard && dueDate && (
          <span className={`badge-due${overdue ? ' overdue' : ''}`}>
            {overdue ? '⚠ ' : ''}{formatDateShort(dueDate)}
          </span>
        )}
        {linkedBadges}
        {card._estimateCount != null && (
          <span className={`estimate-badge${card._estimateCount === 0 ? ' zero' : ''}`}>📋 {card._estimateCount}</span>
        )}
        {card._paymentCount != null && (
          <span className={`payment-badge${card._paymentCount === 0 ? ' zero' : ''}`}>💰 {card._paymentCount}</span>
        )}
      </div>
      {card.nextStep && (
        <div className="meta-line" style={{ marginTop: 5, fontStyle: 'italic', fontSize: 11 }}>→ {card.nextStep}</div>
      )}
    </div>
  );
}
