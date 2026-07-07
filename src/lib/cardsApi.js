// cardsApi.js — the card engine, ported from lib/cards.js + the relevant
// server.js routes. In the original app this logic ran on the Express
// server against data/db.json; here it runs in the browser against
// Supabase, since there is no server in this architecture. Behavior
// (activity logging, cross-board annotation, dashboard metrics) is kept
// identical — only the storage backend changed.
import { supabase } from '../supabaseClient.js';
import { get as getBoard, REGISTRY } from '../boards/index.js';
import { dashboardMetrics, paymentDashboardExtras } from './dashboard.js';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

// ── row <-> card shape ───────────────────────────────────────────────────
function rowToCard(row) {
  return {
    id: row.id,
    board: row.board,
    jobId: row.job_id,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    nextStep: row.next_step,
    latestUpdate: row.latest_update,
    dateUpdated: row.date_updated,
    fields: row.fields || {},
    order: Number(row.order),
    notes: row.notes || [],
    attachments: row.attachments || [],
    activity: row.activity || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function customFieldDefs(bc) {
  const defs = {};
  bc.fieldGroups.forEach(g => g.fields.forEach(f => { defs[f.key] = f; }));
  return defs;
}

function columnLabels(bc) {
  return Object.fromEntries(bc.columns.map(c => [c.id, c.label]));
}

function formatValue(type, value) {
  if (value === null || value === undefined || value === '') return '(none)';
  if (type === 'currency') {
    const n = Number(String(value).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? value : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value;
}

function newActivity(author, action, detail) {
  return { id: crypto.randomUUID(), author, action, detail: detail || '', createdAt: new Date().toISOString() };
}

function orderBetween(prev, next) {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

function countBy(rows, fieldKey) {
  const counts = {};
  (rows || []).forEach(r => {
    const v = r.fields?.[fieldKey];
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return counts;
}

async function selectCardsRaw(boardId) {
  const { data, error } = await supabase.from('cards').select('*').eq('board', boardId);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToCard);
}

// ── card list / detail (with cross-board annotation, like server.js) ─────
export async function fetchCardsForBoard(boardId) {
  const cards = await selectCardsRaw(boardId);

  if (boardId === 'appraisal') {
    const [{ data: estRows, error: e1 }, { data: payRows, error: e2 }] = await Promise.all([
      supabase.from('cards').select('fields').eq('board', 'estimate'),
      supabase.from('cards').select('fields').eq('board', 'payment')
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    const estCounts = countBy(estRows, 'linkedAppraisalId');
    const payCounts = countBy(payRows, 'linkedAppraisalId');
    cards.forEach(c => {
      c._estimateCount = estCounts[c.jobId] || 0;
      c._paymentCount = payCounts[c.jobId] || 0;
    });
  }
  if (boardId === 'estimate') {
    const { data: payRows, error } = await supabase.from('cards').select('fields').eq('board', 'payment');
    if (error) throw new Error(error.message);
    const payCounts = countBy(payRows, 'linkedEstimateId');
    cards.forEach(c => { c._paymentCount = payCounts[c.jobId] || 0; });
  }
  return cards;
}

const shapePayment = r => ({
  id: r.id, jobId: r.job_id, status: r.status,
  propertyAddress: r.fields?.propertyAddress || '',
  vendorName: r.fields?.vendorName || '',
  serviceType: r.fields?.serviceType || '',
  invoiceAmount: r.fields?.invoiceAmount || '',
  amountPaid: r.fields?.amountPaid || '',
  datePaid: r.fields?.datePaid || '',
  paymentMethod: r.fields?.paymentMethod || '',
  assignedTo: r.assigned_to, priority: r.priority
});

export async function fetchCard(boardId, id) {
  const { data: row, error } = await supabase.from('cards').select('*').eq('board', boardId).eq('id', id).single();
  if (error || !row) throw new Error('Job not found.');
  const card = rowToCard(row);

  if (boardId === 'appraisal' && card.jobId) {
    const [{ data: estRows, error: e1 }, { data: payRows, error: e2 }] = await Promise.all([
      supabase.from('cards').select('*').eq('board', 'estimate'),
      supabase.from('cards').select('*').eq('board', 'payment')
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    card._relatedEstimates = (estRows || [])
      .filter(r => r.fields?.linkedAppraisalId === card.jobId)
      .map(r => ({
        id: r.id, jobId: r.job_id, status: r.status,
        propertyAddress: r.fields?.propertyAddress || '',
        estimateType: r.fields?.estimateType || '',
        assignedTo: r.assigned_to, priority: r.priority
      }));
    card._relatedPayments = (payRows || [])
      .filter(r => r.fields?.linkedAppraisalId === card.jobId)
      .map(shapePayment);
  }

  if (boardId === 'estimate') {
    const linkedAppId = card.fields?.linkedAppraisalId;
    if (linkedAppId) {
      const { data: apprRows, error } = await supabase.from('cards').select('*').eq('board', 'appraisal').eq('job_id', linkedAppId).limit(1);
      if (error) throw new Error(error.message);
      const apprRow = apprRows?.[0];
      if (apprRow) {
        card._relatedAppraisal = {
          id: apprRow.id, jobId: apprRow.job_id, status: apprRow.status,
          propertyAddress: apprRow.fields?.propertyAddress || '',
          clientInsured: apprRow.fields?.clientInsured || '',
          claimNumber: apprRow.fields?.claimNumber || '',
          carrier: apprRow.fields?.carrier || '',
          priority: apprRow.priority, assignedTo: apprRow.assigned_to
        };
      }
    }
    if (card.jobId) {
      const { data: payRows, error } = await supabase.from('cards').select('*').eq('board', 'payment');
      if (error) throw new Error(error.message);
      card._relatedPayments = (payRows || []).filter(r => r.fields?.linkedEstimateId === card.jobId).map(shapePayment);
    }
  }

  return card;
}

// ── dashboards ─────────────────────────────────────────────────────────────
export async function fetchBoardDashboard(boardId) {
  const bc = getBoard(boardId);
  const cards = await selectCardsRaw(boardId);
  const metrics = dashboardMetrics(bc, cards);
  const extra = boardId === 'payment' ? paymentDashboardExtras(cards) : {};
  return { ...metrics, ...extra };
}

export async function fetchGlobalDashboard() {
  const perBoard = await Promise.all(REGISTRY.map(async b => {
    const cards = await selectCardsRaw(b.id);
    const metrics = dashboardMetrics(b, cards);
    const extra = b.id === 'payment' ? paymentDashboardExtras(cards) : {};
    return { boardId: b.id, label: b.label, navIcon: b.navIcon || '', comingSoon: b.comingSoon || false, columns: b.columns, cards, ...metrics, ...extra };
  }));

  const allActivity = [];
  perBoard.forEach(b => {
    const bc = getBoard(b.boardId);
    b.cards.forEach(card => {
      card.activity.forEach(a => {
        allActivity.push({
          ...a, cardId: card.id, cardJobId: card.jobId, board: card.board,
          cardTitle: card.fields?.[bc.titleField] || ''
        });
      });
    });
  });
  allActivity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    boards: perBoard.map(({ cards, ...rest }) => rest),
    recentActivity: allActivity.slice(0, 20)
  };
}

// ── mutations ────────────────────────────────────────────────────────────
export async function createCard(bc, payload, author) {
  const defs = customFieldDefs(bc);
  const fields = {};
  Object.keys(defs).forEach(k => { fields[k] = (payload.fields && payload.fields[k]) || ''; });

  const status = payload.status || bc.columns[0].id;

  let jobId = null;
  if (bc.jobIdPrefix) {
    const { data, error } = await supabase.rpc('next_job_id', { prefix: bc.jobIdPrefix });
    if (error) throw new Error(error.message);
    jobId = data;
  }

  const { data: maxRows, error: maxErr } = await supabase
    .from('cards').select('order').eq('board', bc.id).eq('status', status)
    .order('order', { ascending: false }).limit(1);
  if (maxErr) throw new Error(maxErr.message);
  const order = orderBetween(maxRows?.[0]?.order !== undefined ? Number(maxRows[0].order) : undefined, undefined);

  const nowIso = new Date().toISOString();
  const labels = columnLabels(bc);
  const idTag = jobId ? `[${jobId}] ` : '';
  const activity = [newActivity(author, 'created', `${idTag}Job created at "${labels[status] || status}"`)];

  const row = {
    board: bc.id, job_id: jobId, status,
    priority: payload.priority || 'medium',
    assigned_to: payload.assignedTo || '',
    next_step: payload.nextStep || '',
    latest_update: payload.latestUpdate || '',
    date_updated: nowIso.slice(0, 10),
    fields, order,
    notes: [], attachments: [], activity,
    created_at: nowIso, updated_at: nowIso
  };

  const { data, error } = await supabase.from('cards').insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToCard(data);
}

const COMMON_FIELD_LABELS = {
  priority: 'Priority', assignedTo: 'Assigned To',
  nextStep: 'Next Step', latestUpdate: 'Latest Update'
};
const COMMON_FIELD_TO_COLUMN = {
  priority: 'priority', assignedTo: 'assigned_to',
  nextStep: 'next_step', latestUpdate: 'latest_update'
};

// move = { status, order } — order is computed by the caller (BoardView
// already holds the full sorted column in memory during a drag), unlike
// the old server which had to resolve beforeId/afterId itself per request.
export async function updateCard(bc, cardId, patch, move, author) {
  const { data: row, error: fetchErr } = await supabase.from('cards').select('*').eq('id', cardId).eq('board', bc.id).single();
  if (fetchErr || !row) return null;
  const card = rowToCard(row);
  const defs = customFieldDefs(bc);
  const activity = [...card.activity];

  const updates = {};

  Object.keys(COMMON_FIELD_LABELS).forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      const oldVal = card[field], newVal = patch[field];
      if (oldVal !== newVal) {
        const oldD = field === 'priority' ? PRIORITY_LABELS[oldVal] || oldVal : formatValue('text', oldVal);
        const newD = field === 'priority' ? PRIORITY_LABELS[newVal] || newVal : formatValue('text', newVal);
        activity.push(newActivity(author, 'updated', `${COMMON_FIELD_LABELS[field]}: ${oldD || '(none)'} -> ${newD || '(none)'}`));
        updates[COMMON_FIELD_TO_COLUMN[field]] = newVal;
      }
    }
  });

  const fields = { ...card.fields };
  if (patch.fields) {
    Object.keys(defs).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(patch.fields, key)) {
        const oldVal = fields[key], newVal = patch.fields[key];
        if (oldVal !== newVal) {
          const def = defs[key];
          activity.push(newActivity(author, 'updated', `${def.label}: ${formatValue(def.type, oldVal)} -> ${formatValue(def.type, newVal)}`));
          fields[key] = newVal;
        }
      }
    });
  }
  updates.fields = fields;

  if (move && move.status) {
    const oldS = card.status, newS = move.status;
    updates.status = newS;
    updates.order = move.order;
    if (oldS !== newS) {
      const labels = columnLabels(bc);
      activity.push(newActivity(author, 'moved', `Moved from "${labels[oldS] || oldS}" to "${labels[newS] || newS}"`));
    }
  }

  const nowIso = new Date().toISOString();
  updates.activity = activity;
  updates.date_updated = nowIso.slice(0, 10);
  updates.updated_at = nowIso;

  const { data, error } = await supabase.from('cards').update(updates).eq('id', cardId).select().single();
  if (error) throw new Error(error.message);
  return rowToCard(data);
}

export async function deleteCard(bc, cardId) {
  const { error, count } = await supabase.from('cards').delete({ count: 'exact' }).eq('id', cardId).eq('board', bc.id);
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

export async function addNote(bc, cardId, text, author) {
  const { data: row, error: fetchErr } = await supabase.from('cards').select('notes, activity').eq('id', cardId).eq('board', bc.id).single();
  if (fetchErr || !row) return null;
  const note = { id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() };
  const notes = [...(row.notes || []), note];
  const activity = [...(row.activity || []), newActivity(author, 'note', text.length > 80 ? text.slice(0, 80) + '...' : text)];

  const { error } = await supabase.from('cards').update({ notes, activity, updated_at: new Date().toISOString() }).eq('id', cardId);
  if (error) throw new Error(error.message);
  return note;
}

export async function addAttachment(bc, cardId, attachment, author) {
  const { data: row, error: fetchErr } = await supabase.from('cards').select('attachments, activity').eq('id', cardId).eq('board', bc.id).single();
  if (fetchErr || !row) return null;
  const full = { id: crypto.randomUUID(), addedBy: author, addedAt: new Date().toISOString(), ...attachment };
  const attachments = [...(row.attachments || []), full];
  const activity = [...(row.activity || []), newActivity(author, 'attachment', `Added ${attachment.kind === 'file' ? 'file' : 'link'} to ${attachment.category}: ${attachment.label}`)];

  const { error } = await supabase.from('cards').update({ attachments, activity, updated_at: new Date().toISOString() }).eq('id', cardId);
  if (error) throw new Error(error.message);
  return full;
}

// ── file storage ───────────────────────────────────────────────────────────
export async function uploadAttachmentFile(bc, cardId, file, category, author) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${bc.id}/${cardId}/${Date.now()}-${safeName}`;
  const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
  if (uploadErr) throw new Error(uploadErr.message);
  return addAttachment(bc, cardId, { kind: 'file', category, path, label: file.name }, author);
}

export async function getAttachmentSignedUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export { orderBetween, customFieldDefs, formatValue };
