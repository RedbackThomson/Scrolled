// An in-memory `SyncProvider` (docs/sync_design.md §16, Phase 2). It models the
// server semantics the real Supabase RPCs will have — optimistic-concurrency
// revision checks (409 on stale `baseRevision`), monotonic per-account
// `serverSeq` assignment, an idempotency ledger for at-least-once retries, and a
// "current state per record" change log for cursor pulls — with no backend.
// Many providers can attach to one `MockSyncServer`, so a test can converge two
// "devices" through a shared server. It ships in the package (no network SDK) so
// app-side tests can reuse it too.

import { PROTOCOL_VERSION } from './schemas';
import { SyncAuthError, SyncProtocolError, SyncTransientError } from './errors';
import type {
  ProtocolHandshake,
  PullResult,
  PushResult,
  ServerChange,
  SyncChange,
  SyncProvider,
  Unsubscribe,
} from './types';

/** Forced fault for the next provider call, to exercise the engine's backoff. */
export type MockFault = 'none' | 'transient' | 'auth' | 'protocol';

export interface MockSyncServer {
  /** Apply a batch with revision checks + idempotency dedup. Synchronous core
   *  the async provider wraps. */
  applyPush(changes: SyncChange[]): PushResult;
  /** Current records with `serverSeq > cursor`, ordered, paginated. */
  readPull(cursor: number, pageSize: number): PullResult;
  /** Ring the doorbell for every attached provider. */
  poke(): void;
  subscribe(onPoke: () => void): Unsubscribe;
  /** Make the next `readPull` return the cursor-staleness signal (§15) instead
   *  of a delta, modelling a cursor that predates the GC horizon. */
  requireRebootstrapOnce(): void;
  /** Total accepted records currently stored. */
  size(): number;
  /** Force the next provider call to fail with the given fault, then clear it. */
  setFault(fault: MockFault): void;
  takeFault(): MockFault;
}

export interface MockSyncProviderOptions {
  /** Share a server across providers to converge multiple devices. */
  server?: MockSyncServer;
  /** Page size for `pull`; small values exercise paginated bootstrap. */
  pageSize?: number;
  protocolVersion?: number;
  minClientRevision?: number;
}

const KEY_SEP = '|';
const recordKey = (entity: string, uuid: string) => `${entity}${KEY_SEP}${uuid}`;

export function createMockSyncServer(): MockSyncServer {
  const records = new Map<string, ServerChange>();
  const idempotency = new Map<string, { uuid: string; revision: number; serverSeq: number }>();
  const subscribers = new Set<() => void>();
  let seq = 0;
  let pendingFault: MockFault = 'none';
  let rebootstrapOnce = false;

  return {
    applyPush(changes) {
      const applied: PushResult['applied'] = [];
      const conflicts: PushResult['conflicts'] = [];

      for (const change of changes) {
        const cached = idempotency.get(change.idempotency);
        if (cached) {
          // At-least-once retry: replay the original outcome, do not re-apply.
          applied.push(cached);
          continue;
        }

        const key = recordKey(change.entity, change.uuid);
        const current = records.get(key);
        const currentRevision = current?.revision ?? 0;

        if (change.baseRevision !== currentRevision) {
          conflicts.push({
            uuid: change.uuid,
            remote: current
              ? { ...current }
              : // No server record yet but the client thought there was one:
                // report a synthetic deleted remote at revision 0.
                {
                  entity: change.entity,
                  uuid: change.uuid,
                  op: 'delete',
                  payload: change.payload,
                  baseRevision: 0,
                  idempotency: change.idempotency,
                  revision: 0,
                },
          });
          continue;
        }

        seq += 1;
        const accepted: ServerChange = {
          entity: change.entity,
          uuid: change.uuid,
          op: change.op,
          payload: change.payload,
          baseRevision: change.baseRevision,
          idempotency: change.idempotency,
          revision: currentRevision + 1,
          serverSeq: seq,
        };
        records.set(key, accepted);
        const outcome = { uuid: change.uuid, revision: accepted.revision, serverSeq: seq };
        idempotency.set(change.idempotency, outcome);
        applied.push(outcome);
      }

      if (applied.length > 0) this.poke();
      return { applied, conflicts };
    },

    readPull(cursor, pageSize) {
      if (rebootstrapOnce && cursor > 0) {
        rebootstrapOnce = false;
        return { changes: [], nextCursor: cursor, hasMore: false, rebootstrapRequired: true };
      }
      const ahead = [...records.values()]
        .filter((r) => r.serverSeq > cursor)
        .sort((a, b) => a.serverSeq - b.serverSeq);
      const page = ahead.slice(0, pageSize);
      const hasMore = ahead.length > page.length;
      const nextCursor = page.length > 0 ? page[page.length - 1].serverSeq : cursor;
      return { changes: page.map((r) => ({ ...r })), nextCursor, hasMore };
    },

    poke() {
      for (const cb of subscribers) cb();
    },

    subscribe(onPoke) {
      subscribers.add(onPoke);
      return () => {
        subscribers.delete(onPoke);
      };
    },

    requireRebootstrapOnce() {
      rebootstrapOnce = true;
    },

    size: () => records.size,
    setFault: (fault) => {
      pendingFault = fault;
    },
    takeFault: () => {
      const f = pendingFault;
      pendingFault = 'none';
      return f;
    },
  };
}

/** Throw the same error shapes the engine narrows on, so a test can drive the
 *  backoff / auth-refresh / incompatible-protocol paths through the mock. */
function throwFault(fault: MockFault): void {
  if (fault === 'transient') throw new SyncTransientError('mock network failure');
  if (fault === 'auth') throw new SyncAuthError();
  if (fault === 'protocol') throw new SyncProtocolError('mock incompatible client');
}

export function createMockSyncProvider(
  options: MockSyncProviderOptions = {},
): SyncProvider & { server: MockSyncServer } {
  const server = options.server ?? createMockSyncServer();
  const pageSize = options.pageSize ?? 100;
  const handshake: ProtocolHandshake = {
    protocolVersion: options.protocolVersion ?? PROTOCOL_VERSION,
    minClientRevision: options.minClientRevision ?? PROTOCOL_VERSION,
  };

  return {
    server,
    async push(changes) {
      throwFault(server.takeFault());
      return server.applyPush(changes);
    },
    async pull(cursor): Promise<PullResult> {
      throwFault(server.takeFault());
      return server.readPull(cursor, pageSize);
    },
    subscribe(onPoke) {
      return server.subscribe(onPoke);
    },
    async hello(): Promise<ProtocolHandshake> {
      return handshake;
    },
  };
}
