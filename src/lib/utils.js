// utils.js — ported from public/js/utils.js. escapeHtml is dropped: React
// escapes text nodes by default, so there's no innerHTML to sanitize.

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(dueDateIso, statusId, lastColumnId) {
  if (!dueDateIso) return false;
  if (statusId === lastColumnId) return false;
  return dueDateIso < todayIso();
}

export function formatDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y) return iso;
  return `${m}/${d}/${y.slice(2)}`;
}

export function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

export function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
