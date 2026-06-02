// Build the shared `ToolContext` once at startup. Tools receive this when
// the dispatcher invokes them — they never reach for the comlink clients
// themselves, which keeps the in-process tool surface trivially mockable for
// tests (pass any `Remote<GameDatabase>` shape, run the tool).

import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';
import { createServices } from './services';
import type { ToolContext } from './types';

let cached: ToolContext | null = null;

export function buildToolContext(): ToolContext {
  if (!cached) {
    cached = {
      db: getDbClient(),
      userDb: getUserDbClient(),
      services: createServices(),
    };
  }
  return cached;
}

/** Reset the cached context — only used by tests that swap clients. */
export function resetToolContextForTests(): void {
  cached = null;
}
