// An in-memory `SyncProvider` modelling the remote store's semantics: natural-key
// upserts, unique-name rejection, foreign keys to the parent collection, and
// stamped seq/server_time. Modelling the constraints — not just the storage — is
// the point, since convergence bugs only surface when a write is refused.
//
// Many providers can attach to one server, so a test can converge two "devices".

import { PROTOCOL_VERSION, recordKey } from './schemas';
import { SyncAuthError, SyncProtocolError, SyncTransientError } from './errors';
import {
  ENTITY_UNIQUE_NAME,
  SYNC_ENTITIES,
  collidesByName,
  type FetchPage,
  type ProtocolHandshake,
  type RemoteRow,
  type SyncEntity,
  type SyncProvider,
  type TaggedRow,
  type Unsubscribe,
  type UpsertResult,
} from './types';

export type MockFault = 'none' | 'transient' | 'auth' | 'protocol';

export class MockForeignKeyError extends Error {
  constructor(entity: SyncEntity, collectionKey: string) {
    super(`${entity} references unknown collection ${collectionKey}`);
    this.name = 'MockForeignKeyError';
  }
}

export interface MockSyncServer {
  applyUpsert(entity: SyncEntity, rows: RemoteRow[]): UpsertResult;
  readSince(cursor: string | null, pageSize: number): FetchPage;
  readAll(): TaggedRow[];
  findByUnique(entity: SyncEntity, where: RemoteRow): RemoteRow | null;
  gcTombstones(before: string): void;
  poke(originDevice: string): void;
  subscribe(onPoke: (originDevice: string) => void): Unsubscribe;
  /** Rows currently stored, for assertions. */
  rows(entity: SyncEntity): RemoteRow[];
  size(): number;
  setFault(fault: MockFault): void;
  takeFault(): MockFault;
}

export interface MockSyncProviderOptions {
  server?: MockSyncServer;
  /** Small values exercise paginated bootstrap. */
  pageSize?: number;
  protocolVersion?: number;
  minClientRevision?: number;
}

/** `startTime` defaults to now so stamped cursors look recent to the engine's
 *  staleness check; pass a fixed value to assert on exact timestamps. */
export function createMockSyncServer(startTime = Date.now()): MockSyncServer {
  const tables = new Map<SyncEntity, Map<string, TaggedRow>>();
  for (const entity of SYNC_ENTITIES) tables.set(entity, new Map());
  const subscribers = new Set<(originDevice: string) => void>();
  let seq = 0;
  let clock = 0;
  let pendingFault: MockFault = 'none';

  const table = (entity: SyncEntity) => tables.get(entity)!;

  // Strictly increasing so ordering is deterministic; real clocks can repeat.
  const stamp = (): string => {
    clock += 1;
    return new Date(startTime + clock).toISOString();
  };

  const liveRows = (entity: SyncEntity): TaggedRow[] =>
    [...table(entity).values()].filter((t) => t.row.deleted_at == null);

  const nameOwner = (entity: SyncEntity, row: RemoteRow): TaggedRow | null => {
    if (!collidesByName(entity)) return null;
    const unique = ENTITY_UNIQUE_NAME[entity];
    return (
      liveRows(entity).find(
        (t) =>
          t.row[unique.column] === row[unique.column] &&
          unique.scope.every((col: string) => t.row[col] === row[col]),
      ) ?? null
    );
  };

  const collectionExists = (key: unknown): boolean =>
    typeof key === 'string' && table('collection').has(key);

  return {
    applyUpsert(entity, rows) {
      const applied: UpsertResult['applied'] = [];
      const nameCollisions: UpsertResult['nameCollisions'] = [];
      let poked = '';

      for (const row of rows) {
        const key = recordKey(entity, row);

        if (entity === 'collection_group' || entity === 'collection_member') {
          if (!collectionExists(row.collection_key)) {
            throw new MockForeignKeyError(entity, String(row.collection_key));
          }
        }

        const owner = nameOwner(entity, row);
        if (owner && recordKey(entity, owner.row) !== key) {
          nameCollisions.push({ key, entity, row });
          continue;
        }

        seq += 1;
        table(entity).set(key, { entity, row: { ...row }, seq, serverTime: stamp() });
        applied.push({ key, seq });
        poked = String(row.origin_device ?? '');
      }

      if (applied.length > 0) this.poke(poked);
      return { applied, nameCollisions };
    },

    readSince(cursor, pageSize) {
      const ahead = SYNC_ENTITIES.flatMap((entity) =>
        [...table(entity).values()].filter((t) => cursor == null || t.serverTime > cursor),
      ).sort((a, b) => (a.serverTime < b.serverTime ? -1 : a.serverTime > b.serverTime ? 1 : 0));

      const page = ahead.slice(0, pageSize);
      const complete = ahead.length === page.length;
      const next = page.length > 0 ? page[page.length - 1].serverTime : (cursor ?? '');
      return { rows: page.map(clone), cursor: next, complete };
    },

    readAll() {
      return SYNC_ENTITIES.flatMap((entity) => [...table(entity).values()]).map(clone);
    },

    findByUnique(entity, where) {
      const match = liveRows(entity).find((t) =>
        Object.entries(where).every(([col, value]) => t.row[col] === value),
      );
      return match ? { ...match.row } : null;
    },

    gcTombstones(before) {
      for (const entity of SYNC_ENTITIES) {
        for (const [key, t] of table(entity)) {
          const deletedAt = t.row.deleted_at;
          if (typeof deletedAt === 'string' && deletedAt < before) table(entity).delete(key);
        }
      }
    },

    poke(originDevice) {
      for (const cb of subscribers) cb(originDevice);
    },

    subscribe(onPoke) {
      subscribers.add(onPoke);
      return () => {
        subscribers.delete(onPoke);
      };
    },

    rows: (entity) => [...table(entity).values()].map((t) => ({ ...t.row })),
    size: () => SYNC_ENTITIES.reduce((n, e) => n + table(e).size, 0),
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

function clone(t: TaggedRow): TaggedRow {
  return { entity: t.entity, row: { ...t.row }, seq: t.seq, serverTime: t.serverTime };
}

/** Throws the shapes the engine narrows on, so tests can drive backoff, auth
 *  refresh and the incompatible-protocol path. */
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
    async upsert(entity, rows) {
      throwFault(server.takeFault());
      return server.applyUpsert(entity, rows);
    },
    async fetchSince(cursor) {
      throwFault(server.takeFault());
      return server.readSince(cursor, pageSize);
    },
    async fetchAll() {
      throwFault(server.takeFault());
      return server.readAll();
    },
    async findByUnique(entity, where) {
      throwFault(server.takeFault());
      return server.findByUnique(entity, where);
    },
    async gcTombstones(before) {
      server.gcTombstones(before);
    },
    subscribe(onPoke) {
      return server.subscribe(onPoke);
    },
    async hello() {
      return handshake;
    },
  };
}
