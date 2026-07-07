// scripts/migrate-from-json.mjs
// One-time import of the original NCS-board/data/db.json into Supabase.
// Run locally only, after the React app is confirmed working end-to-end:
//   node scripts/migrate-from-json.mjs
//
// Reads NCS-board/data/db.json and NCS-board/uploads/ read-only — the
// original project is never modified.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLD_PROJECT_DIR = path.resolve(__dirname, '..', '..', 'NCS-board');
const DB_JSON_PATH = path.join(OLD_PROJECT_DIR, 'data', 'db.json');
const UPLOADS_DIR = path.join(OLD_PROJECT_DIR, 'uploads');

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your local .env file.');
  process.exit(1);
}
if (!fs.existsSync(DB_JSON_PATH)) {
  console.error(`Could not find ${DB_JSON_PATH}. Is NCS-board/ still a sibling folder of NCS-Board-React/?`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const data = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));

function randomTempPassword() {
  return crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe
}

async function migrateUsers() {
  console.log(`\n== Migrating ${data.users.length} users ==`);
  const tempPasswords = [];
  for (const u of data.users) {
    const username = u.username.trim().toLowerCase();
    const email = `${username}@ncs.local`;
    const tempPassword = randomTempPassword();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { username, name: u.name }
    });
    if (error) {
      console.warn(`  ! Skipped ${username}: ${error.message}`);
      continue;
    }
    await supabase.from('profiles').upsert({ id: created.user.id, username, name: u.name });
    tempPasswords.push({ username, name: u.name, tempPassword });
    console.log(`  + ${username} (${u.name})`);
  }

  console.log('\nBcrypt password hashes cannot be imported into Supabase Auth, so everyone');
  console.log('gets a new temporary password below. Share these securely and have each');
  console.log('person change theirs after first sign-in:\n');
  tempPasswords.forEach(p => console.log(`  ${p.username.padEnd(12)} ${p.tempPassword}`));
}

async function migrateCounters() {
  console.log('\n== Migrating job-id counters ==');
  const entries = Object.entries(data.counters || {});
  for (const [key, value] of entries) {
    const { error } = await supabase.from('counters').upsert({ id: key, value });
    if (error) throw error;
    console.log(`  ${key} -> ${value}`);
  }
}

async function uploadFileAttachment(card, attachment) {
  // Old attachments store url like "/uploads/171234-photo.jpg"
  const filename = attachment.filename || path.basename(attachment.url || '');
  const localPath = path.join(UPLOADS_DIR, filename);
  if (!filename || !fs.existsSync(localPath)) {
    console.warn(`    ! Missing local file for attachment "${attachment.label}" (${filename}), keeping as broken link.`);
    return attachment;
  }
  const storagePath = `${card.board}/${card.id}/${filename}`;
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from('attachments').upload(storagePath, fileBuffer, { upsert: true });
  if (error) {
    console.warn(`    ! Upload failed for ${filename}: ${error.message}`);
    return attachment;
  }
  const { url, filename: _f, ...rest } = attachment;
  return { ...rest, path: storagePath };
}

async function migrateCards() {
  console.log(`\n== Migrating ${data.cards.length} cards ==`);
  for (const card of data.cards) {
    const attachments = [];
    for (const a of card.attachments || []) {
      if (a.kind === 'file') attachments.push(await uploadFileAttachment(card, a));
      else attachments.push(a);
    }

    const row = {
      id: card.id,
      board: card.board,
      job_id: card.jobId || null,
      status: card.status,
      priority: card.priority,
      assigned_to: card.assignedTo || '',
      next_step: card.nextStep || '',
      latest_update: card.latestUpdate || '',
      date_updated: card.dateUpdated,
      fields: card.fields || {},
      notes: card.notes || [],
      attachments,
      activity: card.activity || [],
      order: card.order,
      created_at: card.createdAt,
      updated_at: card.updatedAt
    };
    const { error } = await supabase.from('cards').upsert(row);
    if (error) { console.warn(`  ! Failed to migrate card ${card.jobId || card.id}: ${error.message}`); continue; }
    console.log(`  + ${card.board}/${card.jobId || card.id}`);
  }
}

async function main() {
  await migrateUsers();
  await migrateCounters();
  await migrateCards();
  console.log('\nMigration complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
