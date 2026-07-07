// auth.js — username-based login on top of Supabase Auth.
// Team members type a short username (e.g. "zack"); we map that to a
// synthetic internal email under the hood since Supabase Auth is email-based.
import { supabase } from '../supabaseClient.js';

const EMAIL_DOMAIN = 'ncs.local';

export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export async function signIn(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });
  if (error) {
    // Supabase's message ("Invalid login credentials") already avoids
    // leaking whether the username exists; surface it as-is.
    throw new Error(error.message || 'Incorrect username or password.');
  }
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Current signed-in user's profile row: { id, username, name }
export async function getMyProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, name')
    .eq('id', user.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// All team members, for the "Assigned To" datalist / assignee filter.
export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, name')
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}
