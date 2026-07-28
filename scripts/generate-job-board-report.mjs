// scripts/generate-job-board-report.mjs
// Read-only: pulls all cards from Supabase and renders the branded
// "Full Job List" HTML report (the same design used for the shared
// artifact link). Makes no writes to the database.
//
//   node scripts/generate-job-board-report.mjs <output.html>
//
// <output.html> should be an out-of-repo path (e.g. this session's
// scratchpad) since the report contains real client/insured names,
// addresses, and claim numbers that shouldn't be committed to git.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: node scripts/generate-job-board-report.mjs <output.html>');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your local .env file.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const STATUS_LABELS = {
  appraisal: {
    new_lead: 'New Lead', scheduled: 'Scheduled', waiting_information: 'Waiting Information',
    in_review: 'In Review', estimating: 'Estimating', submitted: 'Submitted',
    waiting_response: 'Waiting Response', completed: 'Completed', closed: 'Closed'
  },
  estimate: {
    new_request: 'New Request', assigned: 'Assigned to Estimator', in_progress: 'In Progress',
    received: 'Estimate Received', needs_review: 'Needs Review', under_revision: 'Under Revision',
    ready_to_send: 'Ready to Send', sent_to_client: 'Sent to Client', completed: 'Completed', closed: 'Closed'
  },
  payment: {
    estimate_completed: 'Estimate Completed', waiting_invoice: 'Waiting for Invoice',
    invoice_received: 'Invoice Received', payment_requested: 'Payment Requested',
    approved_for_payment: 'Approved for Payment', paid: 'Paid', closed: 'Closed'
  }
};

const CLOSED = new Set(['completed', 'paid', 'closed']);
const ATTENTION = new Set(['needs_review', 'waiting_response', 'waiting_information', 'estimate_completed']);
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}

function stateClass(status) {
  if (CLOSED.has(status)) return 'st-closed';
  if (ATTENTION.has(status)) return 'st-attn';
  return 'st-active';
}

function nameFor(board, f) {
  if (board === 'appraisal') return f.clientInsured || '—';
  if (board === 'estimate') return f.jobCategory || f.estimateType || '—';
  if (board === 'payment') return f.vendorName || '—';
  return '—';
}

function subFor(board, f) {
  if (board === 'appraisal') return f.claimNumber ? `Claim ${f.claimNumber}` : '';
  if (board === 'estimate') {
    const bits = [];
    if (f.estimateType && f.estimateType !== f.jobCategory) bits.push(f.estimateType);
    if (f.linkedAppraisalId) bits.push(`Linked ${f.linkedAppraisalId}`);
    return bits.join(' · ');
  }
  if (board === 'payment') return f.serviceType || '';
  return '';
}

function rowsFor(cards, board) {
  const list = cards.filter(c => c.board === board)
    .sort((a, b) => a.job_id.localeCompare(b.job_id, undefined, { numeric: true }));
  return list.map(c => {
    const f = c.fields || {};
    const statusLabel = STATUS_LABELS[board][c.status] || c.status;
    return `      <tr class="${stateClass(c.status)}" data-search="${esc([c.job_id, statusLabel, c.priority, c.assigned_to, c.latest_update, f.propertyAddress, nameFor(board, f)].join(' ').toLowerCase())}">
        <td class="c-id"><span class="prio-dot prio-${c.priority}" title="${PRIORITY_LABEL[c.priority]} priority"></span><span class="mono">${esc(c.job_id)}</span></td>
        <td class="c-name">${esc(nameFor(board, f))}${subFor(board, f) ? `<span class="sub">${esc(subFor(board, f))}</span>` : ''}</td>
        <td class="c-addr mono">${esc(f.propertyAddress || '—')}</td>
        <td><span class="pill pill-${stateClass(c.status)}">${esc(statusLabel)}</span></td>
        <td class="c-assignee">${esc(c.assigned_to || '—')}</td>
        <td class="c-update">${esc(c.latest_update || '—')}</td>
        <td class="c-date mono">${fmtDate(c.date_updated)}</td>
      </tr>`;
  }).join('\n');
}

function statRow(cards, board) {
  const inBoard = cards.filter(c => c.board === board);
  return {
    total: inBoard.length,
    closed: inBoard.filter(c => CLOSED.has(c.status)).length,
    attn: inBoard.filter(c => ATTENTION.has(c.status)).length,
    urgent: inBoard.filter(c => c.priority === 'urgent').length
  };
}

async function main() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('board, job_id, status, priority, assigned_to, latest_update, date_updated, fields')
    .order('board', { ascending: true })
    .order('job_id', { ascending: true });
  if (error) throw error;

  const stats = {
    appraisal: statRow(cards, 'appraisal'),
    estimate: statRow(cards, 'estimate'),
    payment: statRow(cards, 'payment')
  };

  const now = new Date();
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  const repl = {
    __TIMESTAMP__: stamp,
    __TOTAL__: cards.length,
    __APP_TOTAL__: stats.appraisal.total,
    __APP_CLOSED__: stats.appraisal.closed,
    __APP_ATTN__: stats.appraisal.attn,
    __APP_URGENT__: stats.appraisal.urgent,
    __EST_TOTAL__: stats.estimate.total,
    __EST_CLOSED__: stats.estimate.closed,
    __EST_ATTN__: stats.estimate.attn,
    __EST_URGENT__: stats.estimate.urgent,
    __PAY_TOTAL__: stats.payment.total,
    __PAY_CLOSED__: stats.payment.closed,
    __PAY_ATTN__: stats.payment.attn,
    __PAY_URGENT__: stats.payment.urgent,
    __APPRAISAL_ROWS__: rowsFor(cards, 'appraisal'),
    __ESTIMATE_ROWS__: rowsFor(cards, 'estimate'),
    __PAYMENT_ROWS__: rowsFor(cards, 'payment')
  };

  let html = fs.readFileSync(path.join(__dirname, 'job-board-report.template.html'), 'utf8');
  for (const [k, v] of Object.entries(repl)) html = html.split(k).join(String(v));

  fs.writeFileSync(outputPath, html);
  console.log(`Wrote ${html.length} bytes to ${outputPath}`);
  console.log(`Total: ${cards.length} jobs — appraisal ${stats.appraisal.total}, estimate ${stats.estimate.total}, payment ${stats.payment.total}`);
}

main().catch(err => { console.error(err); process.exit(1); });
