import { initials } from '../lib/utils.js';
import ncsLogo from '../assets/NCS_logo1.png';

export default function TopBar({ me, showFilters, config, users, filters, onFilterChange, onClearFilters, onNewJob, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src={ncsLogo} alt="NCS - National Claims Solutions" className="brand-logo" />
        <div>National Claims Solutions<div className="sub">Operations Board</div></div>
      </div>

      <div className="filter-bar" style={{ display: showFilters ? '' : 'none' }}>
        <input
          type="search" placeholder={config?.id === 'task' ? 'Search title, assignee, ID...' : 'Search address, client, ID...'}
          value={filters.search}
          onChange={e => onFilterChange({ ...filters, search: e.target.value })}
        />
        <select aria-label="Filter by status" value={filters.status}
          onChange={e => onFilterChange({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {(config?.columns || []).map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
        </select>
        <select aria-label="Filter by priority" value={filters.priority}
          onChange={e => onFilterChange({ ...filters, priority: e.target.value })}>
          <option value="">All priorities</option>
          {(config?.priorities || []).map(p => <option value={p.id} key={p.id}>{p.label}</option>)}
        </select>
        {config?.assigneeOptions ? (
          <select aria-label="Filter by assignee" value={filters.assignee}
            onChange={e => onFilterChange({ ...filters, assignee: e.target.value })}>
            <option value="">All assignees</option>
            {config.assigneeOptions.map(n => <option value={n} key={n}>{n}</option>)}
          </select>
        ) : (
          <select aria-label="Filter by assignee" value={filters.assignee}
            onChange={e => onFilterChange({ ...filters, assignee: e.target.value })}>
            <option value="">All assignees</option>
            {[...new Set((users || []).map(u => u.name))].sort().map(n => <option value={n} key={n}>{n}</option>)}
          </select>
        )}
        {config?.id === 'task' && (
          <input
            type="date" aria-label="Filter by due date"
            value={filters.dueDate}
            onChange={e => onFilterChange({ ...filters, dueDate: e.target.value })}
          />
        )}
        <button type="button" className="clear-filters" onClick={onClearFilters}>Clear</button>
      </div>

      <button type="button" className="btn btn-primary" style={{ display: showFilters ? '' : 'none' }} onClick={onNewJob}>
        {config?.itemLabel ? `+ New ${config.itemLabel[0].toUpperCase()}${config.itemLabel.slice(1)}` : '+ New job'}
      </button>

      <div className="user-pill">
        <div className="avatar">{initials(me?.name)}</div>
        <span>{me?.name || '...'}</span>
        <button type="button" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  );
}
