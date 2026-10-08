export default function PrimaryNav({ boardsList, activeView, activeBoardId, onSelectDashboard, onSelectBoard }) {
  return (
    <nav className="primary-nav">
      <button className={`nav-item${activeView === 'dashboard' ? ' active' : ''}`} onClick={onSelectDashboard}>
        <span className="nav-icon">🏠</span>Dashboard
      </button>
      {boardsList.map(b => {
        const isActive = activeView !== 'dashboard' && activeBoardId === b.id;
        return (
          <button
            key={b.id}
            className={`nav-item${b.comingSoon ? ' coming-soon' : ''}${isActive ? ' active' : ''}`}
            onClick={() => onSelectBoard(b)}
          >
            <span className="nav-icon">{b.navIcon || ''}</span>{b.label}
          </button>
        );
      })}
      {/* The Time Tracker is a separate site that shares this board's Supabase login. */}
      <a className="nav-item" href="https://ncs-timetracker.netlify.app" target="_blank" rel="noopener">
        <span className="nav-icon">⏱️</span>Time Tracker
      </a>
    </nav>
  );
}
