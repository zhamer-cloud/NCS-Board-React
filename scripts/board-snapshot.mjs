// scripts/board-snapshot.mjs
// Read-only snapshot of the live Supabase board: prints card counts per
// board/status and the current job-id counters. Makes no writes.
//   node scripts/board-snapshot.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your local .env file.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('board, job_id, status, priority, assigned_to, latest_update, date_updated, updated_at')
    .order('board', { ascending: true })
    .order('"order"', { ascending: true });
  if (cardsError) throw cardsError;

  const { data: counters, error: countersError } = await supabase
    .from('counters')
    .select('id, value');
  // counters has no select policy for anon/authenticated, but the service
  // role key bypasses RLS, so this should still succeed.
  if (countersError) console.warn(`  ! Could not read counters: ${countersError.message}`);

  console.log(`Fetched ${cards.length} cards as of ${new Date().toISOString()}\n`);

  const byBoard = {};
  for (const c of cards) {
    (byBoard[c.board] ??= []).push(c);
  }

  for (const [board, list] of Object.entries(byBoard)) {
    console.log(`== ${board} (${list.length}) ==`);
    const byStatus = {};
    for (const c of list) (byStatus[c.status] ??= []).push(c);
    for (const [status, group] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${group.length}`);
      for (const c of group) {
        console.log(`    ${(c.job_id || '(no id)').padEnd(10)} ${c.priority.padEnd(8)} ${c.assigned_to.padEnd(12)} updated ${c.date_updated}  "${c.latest_update}"`);
      }
    }
    console.log('');
  }

  if (counters) {
    console.log('== job-id counters ==');
    for (const c of counters) console.log(`  ${c.id} -> ${c.value}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
