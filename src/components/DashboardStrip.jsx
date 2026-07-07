export default function DashboardStrip({ config, dashboard, filters, onToggleStatus }) {
  return (
    <div className="dashboard-strip">
      <div className={`stat-chip total${!filters.status ? ' active' : ''}`} onClick={() => onToggleStatus('')}>
        <span className="stat-num">{dashboard.totalOpen}</span>
        <span className="stat-label">Total Open</span>
      </div>
      {config.columns.map(col => {
        const count = dashboard.byStatus?.[col.id] || 0;
        return (
          <div key={col.id} className={`stat-chip${filters.status === col.id ? ' active' : ''}`} onClick={() => onToggleStatus(col.id)}>
            <span className="stat-num">{count}</span>
            <span className="stat-label">{col.label}</span>
          </div>
        );
      })}
    </div>
  );
}
