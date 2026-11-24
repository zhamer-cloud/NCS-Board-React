import { formatTimestamp } from '../lib/utils.js';

function fmtAmount(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardView({ data, taskSummary, onOpenBoard }) {
  if (!data) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading dashboard...</p>;

  return (
    <div className="dashboard-view">
      <h1>NCS Operations System</h1>
      <p className="subtitle">Overview across all boards</p>

      <div className="dash-grid">
        {data.boards.map(b => {
          const maxCount = Math.max(1, ...Object.values(b.byStatus || {}));
          const statusEntries = Object.entries(b.byStatus || {})
            .filter(([, n]) => n > 0).sort((a, c) => c[1] - a[1]).slice(0, 5);

          return (
            <div key={b.boardId} className={`dash-board-card${b.comingSoon ? ' coming-soon' : ''}`}>
              <div className="dbc-head">
                <div className="dbc-title"><span>{b.navIcon || ''}</span>{b.label}</div>
                {!b.comingSoon
                  ? <span className="dbc-goto" onClick={() => onOpenBoard(b.boardId, {})}>Open →</span>
                  : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coming soon</span>}
              </div>
              <div className="dbc-open" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'open' })}>{b.totalOpen}</div>
              <div className="dbc-open-label" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'open' })}>open jobs</div>
              <div className="dbc-status-list">
                {statusEntries.length
                  ? statusEntries.map(([sid, count]) => {
                    const col = (b.columns || []).find(c => c.id === sid);
                    const label = col ? col.label : sid.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const pct = Math.round(count / maxCount * 100);
                    return (
                      <div className="dbc-status-row" key={sid} style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { status: sid })}>
                        <span className="name">{label}</span>
                        <div className="dbc-bar-wrap"><div className="dbc-bar" style={{ width: `${pct}%` }}></div></div>
                        <span className="count">{count}</span>
                      </div>
                    );
                  })
                  : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No jobs yet</div>}
              </div>
              {b.boardId === 'payment' && (
                <div className="dash-payment-metrics">
                  <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'outstanding' })}><div className="pm-num amount">{fmtAmount(b.totalOutstandingAmount)}</div><div className="pm-label">Outstanding</div></div>
                  <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { status: 'payment_requested' })}><div className="pm-num">{b.paymentsRequestedCount || 0}</div><div className="pm-label">Requested</div></div>
                  <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'outstanding' })}><div className="pm-num">{b.paymentsPendingCount || 0}</div><div className="pm-label">Pending</div></div>
                  <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'paid_month' })}><div className="pm-num">{b.paidThisMonthCount || 0}</div><div className="pm-label">Paid This Month</div></div>
                  <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(b.boardId, { bucket: 'paid_month' })}><div className="pm-num amount">{fmtAmount(b.paidThisMonthAmount)}</div><div className="pm-label">Paid Amount</div></div>
                </div>
              )}
            </div>
          );
        })}

        {taskSummary && (
          <div className="dash-board-card">
            <div className="dbc-head">
              <div className="dbc-title"><span>✅</span>TASK</div>
              <span className="dbc-goto" onClick={() => onOpenBoard('task', {})}>Open →</span>
            </div>
            <div className="dbc-open" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard('task', { bucket: 'open' })}>{taskSummary.open}</div>
            <div className="dbc-open-label" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onOpenBoard('task', { bucket: 'open' })}>open tasks</div>
            <div className="dash-task-metrics">
              <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard('task', { bucket: 'open' })}><div className="pm-num">{taskSummary.open}</div><div className="pm-label">Open</div></div>
              <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard('task', { bucket: 'due_today' })}><div className="pm-num">{taskSummary.dueToday}</div><div className="pm-label">Due Today</div></div>
              <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard('task', { bucket: 'overdue' })}><div className="pm-num overdue">{taskSummary.overdue}</div><div className="pm-label">Overdue</div></div>
              <div className="pay-metric" style={{ cursor: 'pointer' }} onClick={() => onOpenBoard('task', { status: 'completed' })}><div className="pm-num">{taskSummary.completed}</div><div className="pm-label">Completed</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="dash-activity">
        <h2>Recent Activity</h2>
        {data.recentActivity.length
          ? data.recentActivity.map((a, i) => {
            const bl = data.boards.find(b => b.boardId === a.board)?.label || a.board;
            const rawTitle = a.cardTitle || '';
            const titleText = rawTitle.slice(0, 40) + (rawTitle.length > 40 ? '…' : '');
            return (
              <div className="act-row" key={a.id || i} style={{ cursor: 'pointer' }} onClick={() => onOpenBoard(a.board, {})}>
                <span className="act-who">{a.author}</span>
                <span className="act-board">{bl}</span>
                <span className="act-body"><strong>{a.cardJobId ? a.cardJobId + ' · ' : ''}{titleText}</strong> — {a.detail}</span>
                <span className="act-time">{formatTimestamp(a.createdAt)}</span>
              </div>
            );
          })
          : <div className="thread-empty">No activity yet.</div>}
      </div>
    </div>
  );
}
