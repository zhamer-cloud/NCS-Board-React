// scripts/add-user.mjs — port of NCS-board/scripts/add-user.js.
// Creates (or resets) a team member's login using the Supabase Admin API.
// Run locally only: node scripts/add-user.mjs "username" "password" "Display Name"
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [, , username, password, ...nameParts] = process.argv;
const name = nameParts.join(' ');

if (!username || !password || !name) {
  console.error('Usage: node scripts/add-user.mjs "username" "password" "Display Name"');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your local .env file.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${username.trim().toLowerCase()}@ncs.local`;

async function main() {
  const { data: existing, error: findErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { username: username.trim().toLowerCase(), name }
    });
    if (error) throw error;
    await supabase.from('profiles').upsert({ id: existing.id, username: username.trim().toLowerCase(), name });
    console.log(`Password reset for existing user "${username}".`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: username.trim().toLowerCase(), name }
  });
  if (error) throw error;
  // The on_auth_user_created trigger (supabase/schema.sql) creates the
  // profiles row automatically; upsert here too in case the trigger
  // hasn't been applied yet.
  await supabase.from('profiles').upsert({ id: data.user.id, username: username.trim().toLowerCase(), name });
  console.log(`Created user "${username}" (${name}).`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
