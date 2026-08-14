// Test accounts for the local stack.
//
// Two browser windows signing into the SAME account is the case worth
// exercising, since that is what cross-device sync means here. The second
// account exists to check that signing in as someone else discards local data
// rather than mixing the two.

import { createClient } from '@supabase/supabase-js';
import { readLocalSupabase, type LocalSupabase } from './localSupabase.ts';

export interface TestAccount {
  email: string;
  password: string;
}

export const PRIMARY: TestAccount = { email: 'dev@scrolled.test', password: 'scrolled-dev-pw' };
export const SECONDARY: TestAccount = { email: 'other@scrolled.test', password: 'scrolled-dev-pw' };

export interface SeededAccount extends TestAccount {
  id: string;
  created: boolean;
}

/** Create the account if it is missing. Safe to run repeatedly. */
export async function seedAccount(
  account: TestAccount,
  config: LocalSupabase = readLocalSupabase(),
): Promise<SeededAccount> {
  const admin = createClient(config.apiUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: 'Scrolled Dev' },
  });

  if (!error && data.user) return { ...account, id: data.user.id, created: true };

  // Already there from an earlier run; signing in is the simplest way to
  // confirm the password still matches and to learn the id.
  const { accountId } = await accessTokenFor(account, config);
  return { ...account, id: accountId, created: false };
}

/** Sign in and return a live access token, for tests that drive the wire
 *  directly rather than through a browser. */
export async function accessTokenFor(
  account: TestAccount,
  config: LocalSupabase = readLocalSupabase(),
): Promise<{ token: string; accountId: string }> {
  const client = createClient(config.apiUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword(account);
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  return { token: data.session.access_token, accountId: data.session.user.id };
}

/** Remove every synced row for an account, so a test or a manual run starts clean. */
export async function wipeAccount(
  accountId: string,
  config: LocalSupabase = readLocalSupabase(),
): Promise<void> {
  const admin = createClient(config.apiUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Collections cascade to their groups and members.
  for (const table of [
    'sync_collections',
    'sync_pinned_searches',
    'sync_user_settings',
    'sync_recents',
  ]) {
    await admin.from(table).delete().eq('account_id', accountId);
  }
}
