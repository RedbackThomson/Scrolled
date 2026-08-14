// Reads the running local Supabase stack's connection details. The keys are the
// CLI's well-known development defaults, but they are read rather than hardcoded
// so this keeps working if the CLI changes them.

import { execFileSync } from 'node:child_process';

export interface LocalSupabase {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
}

export class SupabaseNotRunning extends Error {
  constructor() {
    super('local Supabase is not running — start it with `nix develop -c supabase start`');
    this.name = 'SupabaseNotRunning';
  }
}

export function readLocalSupabase(): LocalSupabase {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new SupabaseNotRunning();
  }

  const values = new Map<string, string>();
  for (const line of output.split('\n')) {
    const match = /^([A-Z0-9_]+)="(.*)"$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }

  const apiUrl = values.get('API_URL');
  // Older CLI versions only emit the legacy anon key.
  const publishableKey = values.get('PUBLISHABLE_KEY') ?? values.get('ANON_KEY');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  if (!apiUrl || !publishableKey || !serviceRoleKey) throw new SupabaseNotRunning();

  return { apiUrl, publishableKey, serviceRoleKey };
}

export function isRunning(): boolean {
  try {
    readLocalSupabase();
    return true;
  } catch {
    return false;
  }
}
