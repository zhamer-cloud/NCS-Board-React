// tasksApi.js — data access for the internal TASK board (Louie / Zack /
// Jobe). Deliberately mirrors cardsApi.js's function shapes and the
// generic "card" object shape (id, jobId, status, priority, assignedTo,
// nextStep, latestUpdate, fields, order, notes, activity...) so the same
// BoardView/JobCard/CardModal/DashboardStrip components can render tasks
// without knowing they're backed by a different Supabase table. cardsApi.js
// itself is never imported for its Supabase calls here — only its pure
// helpers are reused.
import { supabase } from '../supabaseClient.js';
import { orderBetween } from './cardsApi.js';
import { dashboardMetrics } from './dashboard.js';
import { todayIso, isOverdue } from './utils.js';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

function rowToTask(row) {
  return {
    id: row.id,
    board: 'task',
    jobId: row.task_id,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assignee,
    nextStep: row.next_step,
    latestUpdate: row.description,
    dateUpdated: row.updated_at ? row.updated_at.slice(0, 10) : '',
    fields: { title: row.title, dueDate: row.due_date || '' },
    order: Number(row.order),
    notes: row.notes || [],
    attachments: [],
    activity: row.activity || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function newActivity(author, action, detail) {
  return { id: crypto.randomUUID(), author, action, detail: detail || '', createdAt: new Date().toISOString() };
}

function columnLabels(bc) {
  return Object.fromEntries(bc.columns.map(c => [c.id, c.label]));
}

async function selectTasksRaw() {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToTask);
}

export async function fetchTasksForBoard() {
  return selectTasksRaw();
}

export async function fetchTaskDashboard(bc) {
  const tasks = await selectTasksRaw();
  return dashboardMetrics(bc, tasks);
}

export async function fetchTaskSummary() {
  const tasks = await selectTasksRaw();
  const today = todayIso();
  let open = 0, dueToday = 0, overdue = 0, completed = 0;
  tasks.forEach(t => {
    if (t.status === 'completed') { completed++; return; }
    open++;
    const due = t.fields?.dueDate;
    if (due === today) dueToday++;
    else if (isOverdue(due, t.status, 'completed')) overdue++;
  });
  const openTasks = tasks.filter(t => t.status !== 'completed')
    .sort((x, y) => (x.order || 0) - (y.order || 0))
    .map(t => ({ id: t.id, jobId: t.jobId, title: t.fields?.title || '', dueDate: t.fields?.dueDate || '', status: t.status, priority: t.priority, assignedTo: t.assignedTo }));
  return { open, dueToday, overdue, completed, openTasks };
}

export async function fetchTask(_boardId, id) {
  const { data: row, error } = await supabase.from('tasks').select('*').eq('id', id).single();
  if (error || !row) throw new Error('Task not found.');
  return rowToTask(row);
}

export async function createTask(bc, payload, author) {
  const title = (payload.fields && payload.fields.title) || '';
  const dueDate = (payload.fields && payload.fields.dueDate) || '';
  const status = payload.status || bc.columns[0].id;

  const { data: taskId, error: idErr } = await supabase.rpc('next_job_id', { prefix: 'TASK' });
  if (idErr) throw new Error(idErr.message);

  const { data: maxRows, error: maxErr } = await supabase
    .from('tasks').select('order').eq('status', status)
    .order('order', { ascending: false }).limit(1);
  if (maxErr) throw new Error(maxErr.message);
  const order = orderBetween(maxRows?.[0]?.order !== undefined ? Number(maxRows[0].order) : undefined, undefined);

  const nowIso = new Date().toISOString();
  const labels = columnLabels(bc);
  const activity = [newActivity(author, 'created', `[${taskId}] Task created at "${labels[status] || status}"`)];

  const row = {
    task_id: taskId, title, assignee: payload.assignedTo || '', priority: payload.priority || 'medium',
    status, due_date: dueDate || null, description: payload.latestUpdate || '', next_step: payload.nextStep || '',
    notes: [], activity, order, created_by: author,
    created_at: nowIso, updated_at: nowIso
  };

  const { data, error } = await supabase.from('tasks').insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToTask(data);
}

const COMMON_FIELD_LABELS = { priority: 'Priority', assignedTo: 'Assigned To', nextStep: 'Next Step', latestUpdate: 'Description / Notes' };
const COMMON_FIELD_TO_COLUMN = { priority: 'priority', assignedTo: 'assignee', nextStep: 'next_step', latestUpdate: 'description' };

export async function updateTask(bc, taskId, patch, move, author) {
  const { data: row, error: fetchErr } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (fetchErr || !row) return null;
  const task = rowToTask(row);
  const activity = [...task.activity];
  const updates = {};

  Object.keys(COMMON_FIELD_LABELS).forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      const oldVal = task[field], newVal = patch[field];
      if (oldVal !== newVal) {
        const oldD = field === 'priority' ? PRIORITY_LABELS[oldVal] || oldVal : (oldVal || '(none)');
        const newD = field === 'priority' ? PRIORITY_LABELS[newVal] || newVal : (newVal || '(none)');
        activity.push(newActivity(author, 'updated', `${COMMON_FIELD_LABELS[field]}: ${oldD} -> ${newD}`));
        updates[COMMON_FIELD_TO_COLUMN[field]] = newVal;
      }
    }
  });

  if (patch.fields) {
    const fields = { ...task.fields };
    if (Object.prototype.hasOwnProperty.call(patch.fields, 'title') && patch.fields.title !== fields.title) {
      activity.push(newActivity(author, 'updated', `Task Title: ${fields.title || '(none)'} -> ${patch.fields.title || '(none)'}`));
      updates.title = patch.fields.title;
    }
    if (Object.prototype.hasOwnProperty.call(patch.fields, 'dueDate') && patch.fields.dueDate !== fields.dueDate) {
      activity.push(newActivity(author, 'updated', `Due Date: ${fields.dueDate || '(none)'} -> ${patch.fields.dueDate || '(none)'}`));
      updates.due_date = patch.fields.dueDate || null;
    }
  }

  if (move && move.status) {
    const oldS = task.status, newS = move.status;
    updates.status = newS;
    updates.order = move.order;
    if (oldS !== newS) {
      const labels = columnLabels(bc);
      activity.push(newActivity(author, 'moved', `Moved from "${labels[oldS] || oldS}" to "${labels[newS] || newS}"`));
    }
  }

  updates.activity = activity;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select().single();
  if (error) throw new Error(error.message);
  return rowToTask(data);
}

export async function deleteTask(_bc, taskId) {
  const { error, count } = await supabase.from('tasks').delete({ count: 'exact' }).eq('id', taskId);
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

export async function addTaskNote(_bc, taskId, text, author) {
  const { data: row, error: fetchErr } = await supabase.from('tasks').select('notes, activity').eq('id', taskId).single();
  if (fetchErr || !row) return null;
  const note = { id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() };
  const notes = [...(row.notes || []), note];
  const activity = [...(row.activity || []), newActivity(author, 'note', text.length > 80 ? text.slice(0, 80) + '...' : text)];

  const { error } = await supabase.from('tasks').update({ notes, activity, updated_at: new Date().toISOString() }).eq('id', taskId);
  if (error) throw new Error(error.message);
  return note;
}
