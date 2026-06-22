// Thin wrapper around `@sqlite.org/sqlite-wasm` that opens an OPFS-backed
// database with an in-memory fallback. Runs migrations on open and exposes a
// small typed surface for the worker to use.

import sqlite3InitModule, {
  type Database,
  type SqlValue,
  type BindingSpec,
  type SAHPoolUtil,
  type Sqlite3Static,
} from '@sqlite.org/sqlite-wasm';

import { MIGRATIONS, type Migration } from './migrations';
import { createLogger, describeError } from '../lib/logger';

const log = createLogger('db-sqlite');

export type Row = Record<string, SqlValue>;
export type Backend = 'opfs' | 'memory';

const DEFAULT_OPFS_FILENAME = '/scrolled.sqlite3';
const DEFAULT_POOL_NAME = 'scrolled-db-pool';

export interface OpenResult {
  backend: Backend;
  schemaVersion: number;
  /** True if `resetBeforeMigrate` cleared the cache on this open. */
  didDestructiveReset: boolean;
}

/**
 * Minimal surface handed to a `resetBeforeMigrate` hook. Lets the caller read
 * metadata and destructively reset the cache without exposing the full engine.
 */
export interface PreMigrateContext {
  selectValue<T extends SqlValue = SqlValue>(sql: string, bind?: BindingSpec): T | null;
  /** True if any non-internal table holds at least one row. */
  hasAnyUserData(): boolean;
  /** DELETE every row from all non-internal tables (schema + ledger kept). */
  clearAllUserData(): void;
}

export interface SqliteOptions {
  /** OPFS path for the DB file. Must be unique across `Sqlite` instances or
   *  the pool will hand them the same file. */
  opfsFilename?: string;
  /** SAH-pool VFS name. Two `Sqlite` instances using the same pool name will
   *  race for sync-access handles and one open will throw — give each DB its
   *  own pool name. */
  poolName?: string;
  /** Ordered list of migrations to apply. Defaults to the game-data set. */
  migrations?: readonly Migration[];
  /** Tag used in log lines so two DBs are distinguishable in the console. */
  logTag?: string;
  /**
   * Echo every executed SQL statement to the console (the sqlite3 `t` open
   * flag). Off by default — on a full extraction it emits hundreds of thousands
   * of lines. Intended only for debugging a specific query.
   */
  traceSql?: boolean;
  /**
   * Optional hook run after the database opens but *before* migrations. Lets a
   * caller destructively reset an incompatible derived cache (clear all rows)
   * so that breaking migrations apply to empty tables instead of failing on a
   * populated one. Return true if it cleared data. Only the derived game cache
   * sets this — the user-authored DB must not, or it would wipe real data.
   */
  resetBeforeMigrate?: (ctx: PreMigrateContext) => boolean;
}

export class Sqlite {
  private sqlite3: Sqlite3Static | null = null;
  private db: Database | null = null;
  private _backend: Backend = 'memory';
  private _fallbackReason: string | null = null;
  private _fallbackDetail: string | null = null;
  private pool: SAHPoolUtil | null = null;
  private readonly opfsFilename: string;
  private readonly poolName: string;
  private readonly migrations: readonly Migration[];
  private readonly logTag: string;
  private readonly traceSql: boolean;
  private readonly resetBeforeMigrate?: (ctx: PreMigrateContext) => boolean;

  constructor(options: SqliteOptions = {}) {
    this.opfsFilename = options.opfsFilename ?? DEFAULT_OPFS_FILENAME;
    this.poolName = options.poolName ?? DEFAULT_POOL_NAME;
    this.migrations = options.migrations ?? MIGRATIONS;
    this.logTag = options.logTag ?? this.opfsFilename;
    this.traceSql = options.traceSql ?? false;
    this.resetBeforeMigrate = options.resetBeforeMigrate;
  }

  get backend(): Backend {
    return this._backend;
  }

  /** Reason the in-memory fallback was used. Null when OPFS opened cleanly. */
  get fallbackReason(): string | null {
    return this._fallbackReason;
  }

  /**
   * Verbose diagnostics for the in-memory fallback — the raw install error
   * (message + stack) plus the capability probe. Hides nothing; meant for the
   * "Advanced" disclosure on the storage-unavailable screen and bug reports.
   * Null when OPFS opened cleanly.
   */
  get fallbackDetail(): string | null {
    return this._fallbackDetail;
  }

  async open(): Promise<OpenResult> {
    if (this.db) {
      return {
        backend: this._backend,
        schemaVersion: this.currentSchemaVersion(),
        didDestructiveReset: false,
      };
    }

    log.info('initializing sqlite3 module', { db: this.logTag });
    this.sqlite3 = await sqlite3InitModule();
    log.info('sqlite3 ready', { db: this.logTag, version: this.sqlite3.version.libVersion });

    const opfsCapabilities = await probeOpfsCapabilities();
    log.info('opfs capability probe', { db: this.logTag, ...opfsCapabilities });

    try {
      const pool = await this.sqlite3.installOpfsSAHPoolVfs({ name: this.poolName });
      this.db = new pool.OpfsSAHPoolDb(this.opfsFilename);
      this.pool = pool;
      this._backend = 'opfs';
      this._fallbackReason = null;
      this._fallbackDetail = null;
      log.info('opened OPFS-backed database', {
        db: this.logTag,
        path: this.opfsFilename,
        pool: this.poolName,
        capacity: pool.getCapacity(),
        fileCount: pool.getFileCount(),
      });
    } catch (err) {
      log.warn('OPFS unavailable; using in-memory database (will not persist)', {
        db: this.logTag,
        ...describeError(err),
        capabilities: opfsCapabilities,
      });
      this.db = new this.sqlite3.oo1.DB(':memory:', this.traceSql ? 'ct' : 'c');
      this._backend = 'memory';
      this._fallbackReason = summarizeFallbackReason(err, opfsCapabilities);
      this._fallbackDetail = describeFallbackDetail(
        err,
        opfsCapabilities,
        this.logTag,
        this.opfsFilename,
        this.poolName,
      );
    }

    this.db.exec('PRAGMA foreign_keys = ON;');

    // Destructive-reset fallback (Room-style): clear an incompatible cache
    // before migrating, so breaking migrations run against empty tables.
    let didDestructiveReset = false;
    if (this.resetBeforeMigrate) {
      try {
        didDestructiveReset = this.resetBeforeMigrate(this);
        if (didDestructiveReset) {
          log.info('destructively reset cache before migrating', { db: this.logTag });
        }
      } catch (err) {
        log.warn('pre-migration reset hook threw; continuing without reset', {
          db: this.logTag,
          ...describeError(err),
        });
      }
    }

    this.runMigrations();

    const version = this.currentSchemaVersion();
    log.info('database open', {
      db: this.logTag,
      backend: this._backend,
      schemaVersion: version,
    });
    return { backend: this._backend, schemaVersion: version, didDestructiveReset };
  }

  /**
   * True if any non-internal table holds at least one row. Used to tell a
   * fresh database (genuine first run) apart from a populated one that needs a
   * destructive reset. Excludes `_migrations` and `app_meta` (metadata, not
   * user data).
   */
  hasAnyUserData(): boolean {
    const db = this.require();
    const tables = db
      .selectObjects(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_migrations','app_meta')",
      )
      .map((r) => String(r.name));
    for (const t of tables) {
      if (db.selectValue(`SELECT 1 FROM "${t}" LIMIT 1`) != null) return true;
    }
    return false;
  }

  /**
   * DELETE every row from all non-internal tables, keeping the schema and the
   * `_migrations` ledger intact. Generic — no domain table names — so it stays
   * correct as the schema evolves.
   */
  clearAllUserData(): void {
    const db = this.require();
    const tables = db
      .selectObjects(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations'",
      )
      .map((r) => String(r.name));
    this.transaction(() => {
      for (const t of tables) db.exec(`DELETE FROM "${t}"`);
      const hasSeq =
        db.selectValue(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'",
        ) != null;
      if (hasSeq) db.exec('DELETE FROM sqlite_sequence');
    });
  }

  /** Execute a one-shot statement (DDL or write). */
  exec(sql: string, bind?: BindingSpec): void {
    try {
      this.require().exec({ sql, bind });
    } catch (e) {
      logSqlFailure('exec', sql, bind, e);
      throw e;
    }
  }

  /** Run a query and return all rows as plain objects. */
  selectObjects<T extends Row = Row>(sql: string, bind?: BindingSpec): T[] {
    try {
      return this.require().selectObjects(sql, bind) as T[];
    } catch (e) {
      logSqlFailure('selectObjects', sql, bind, e);
      throw e;
    }
  }

  /** Run a query expected to return at most one row. */
  selectObject<T extends Row = Row>(sql: string, bind?: BindingSpec): T | null {
    try {
      const row = this.require().selectObject(sql, bind) as T | undefined;
      return row ?? null;
    } catch (e) {
      logSqlFailure('selectObject', sql, bind, e);
      throw e;
    }
  }

  /** Run a query expected to return a single scalar. */
  selectValue<T extends SqlValue = SqlValue>(sql: string, bind?: BindingSpec): T | null {
    try {
      const value = this.require().selectValue(sql, bind);
      return (value ?? null) as T | null;
    } catch (e) {
      logSqlFailure('selectValue', sql, bind, e);
      throw e;
    }
  }

  /** Wrap `fn` in a transaction. Throws if anything inside throws. */
  transaction<T>(fn: () => T): T {
    const db = this.require();
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // best effort
      }
      throw e;
    }
  }

  /**
   * Serialize the entire database to a Uint8Array. The result is a valid
   * SQLite file the user can save and re-import later. Works on both OPFS
   * and in-memory backends — sqlite3's `sqlite3_js_db_export` wraps the
   * underlying `sqlite3_serialize` C API.
   *
   * Roughly twice the database size in peak memory while the byte array is
   * being built; for the MapleRoyals dataset this is ~150-300 MB.
   */
  exportBytes(): Uint8Array {
    const sqlite3 = this.sqlite3;
    const db = this.require();
    if (!sqlite3) throw new Error('[scrolled] sqlite3 not initialized');
    return sqlite3.capi.sqlite3_js_db_export(db);
  }

  /**
   * Replace the database with the contents of the given byte array. Used
   * by the import-database feature in Settings. Steps:
   *
   *   1. Close the live connection.
   *   2. Either write into the OPFS SAH pool (preferred — survives reload)
   *      or deserialize into a fresh in-memory database.
   *   3. Reopen the connection on the same path/handle.
   *   4. Run any migrations the imported DB is behind on.
   *
   * Throws if the bytes don't look like a SQLite file. Memory-backend
   * imports work for the current session but won't persist after reload.
   */
  async importBytes(bytes: Uint8Array): Promise<OpenResult> {
    const sqlite3 = this.sqlite3;
    if (!sqlite3) throw new Error('[scrolled] sqlite3 not initialized — call open() first');
    if (!looksLikeSqlite(bytes)) {
      throw new Error('Input does not look like a SQLite database (header magic missing)');
    }

    const previousBackend = this._backend;
    log.info('importBytes', { bytes: bytes.byteLength, backend: previousBackend });

    // Close so the pool / memory DB doesn't have a dangling handle on the
    // file we're about to replace.
    try {
      this.db?.close();
    } catch (e) {
      log.warn('close before import threw', describeError(e));
    }
    this.db = null;

    if (previousBackend === 'opfs' && this.pool) {
      await this.pool.importDb(this.opfsFilename, bytes);
      this.db = new this.pool.OpfsSAHPoolDb(this.opfsFilename);
      this._backend = 'opfs';
    } else {
      // Memory fallback: deserialize directly into a fresh DB. The bytes
      // need to be copied into WASM-owned memory so the engine retains
      // ownership across calls.
      const db = new sqlite3.oo1.DB(':memory:', this.traceSql ? 'ct' : 'c');
      const wasm = sqlite3.wasm;
      const ptr = wasm.allocFromTypedArray(bytes);
      const flags =
        sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE;
      const rc = sqlite3.capi.sqlite3_deserialize(
        db,
        'main',
        ptr,
        bytes.byteLength,
        bytes.byteLength,
        flags,
      );
      if (rc !== sqlite3.capi.SQLITE_OK) {
        wasm.dealloc(ptr);
        db.close();
        throw new Error(`sqlite3_deserialize failed: rc=${rc}`);
      }
      this.db = db;
      this._backend = 'memory';
    }

    this.db.exec('PRAGMA foreign_keys = ON;');

    // Same destructive-reset fallback as open(): an incompatible backup is
    // incompatible however it arrived, so clear it before migrating.
    let didDestructiveReset = false;
    if (this.resetBeforeMigrate) {
      try {
        didDestructiveReset = this.resetBeforeMigrate(this);
      } catch (err) {
        log.warn('pre-migration reset hook threw during import; continuing', {
          db: this.logTag,
          ...describeError(err),
        });
      }
    }

    this.runMigrations();
    const version = this.currentSchemaVersion();
    log.info('importBytes complete', { backend: this._backend, schemaVersion: version });
    return { backend: this._backend, schemaVersion: version, didDestructiveReset };
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // best effort
      }
      this.db = null;
    }
  }

  // -- migrations ------------------------------------------------------------

  private currentSchemaVersion(): number {
    if (!this.db) return 0;
    try {
      const v = this.db.selectValue('SELECT MAX(version) FROM _migrations');
      return typeof v === 'number' ? v : 0;
    } catch {
      return 0;
    }
  }

  private runMigrations(): void {
    const db = this.require();
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    const applied = new Set(
      db.selectObjects('SELECT version FROM _migrations').map((r) => Number(r.version)),
    );

    for (const m of this.migrations) {
      if (applied.has(m.version)) continue;
      log.info('applying migration', { db: this.logTag, version: m.version, name: m.name });
      this.transaction(() => {
        db.exec(m.sql);
        db.exec({
          sql: 'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          bind: [m.version, m.name, Date.now()],
        });
      });
    }
  }

  private require(): Database {
    if (!this.db) throw new Error('[scrolled] sqlite database not open');
    return this.db;
  }
}

/**
 * Mirror SQL failures to the console (and the ring-buffer log that backs bug
 * reports) so callers don't have to wrap every query in try/catch. We never
 * swallow — the original error is rethrown by the caller.
 */
function logSqlFailure(op: string, sql: string, bind: BindingSpec | undefined, e: unknown): void {
  // Condense whitespace so multi-line SQL stays readable in console logs.
  const condensed = sql.replace(/\s+/g, ' ').trim();
  log.error(`${op} failed`, {
    sql: condensed,
    bind: describeBind(bind),
    ...describeError(e),
  });
}

/** Truncate large BLOB params so the log entry stays small. */
function describeBind(bind: BindingSpec | undefined): unknown {
  if (bind === undefined || bind === null) return bind;
  if (Array.isArray(bind)) return bind.map(describeBindValue);
  if (typeof bind === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bind)) out[k] = describeBindValue(v);
    return out;
  }
  return describeBindValue(bind);
}

function describeBindValue(v: unknown): unknown {
  if (v instanceof Uint8Array) return `<Uint8Array ${v.byteLength} bytes>`;
  return v;
}

interface OpfsCapabilities {
  hasNavigatorStorage: boolean;
  hasGetDirectory: boolean;
  hasFileSystemSyncAccessHandle: boolean;
  isSecureContext: boolean;
  origin: string | null;
  rootDirectoryError: string | null;
}

/**
 * Best-effort detection of why OPFS might be unavailable. Surfaced via the
 * diagnostics log alongside the actual install error.
 */
/** SQLite files start with the ASCII magic string `SQLite format 3\0`. */
function looksLikeSqlite(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 16) return false;
  const MAGIC = 'SQLite format 3\0';
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Build a short, user-facing reason for the in-memory fallback. Capability
 * probes win over the raw install error because they pinpoint *why* OPFS is
 * off (insecure context, no `getDirectory`, no sync-access handle) rather
 * than the SQLite-WASM message, which is usually a generic install failure.
 */
function summarizeFallbackReason(err: unknown, caps: OpfsCapabilities): string {
  if (!caps.isSecureContext) {
    return 'Page is not served over HTTPS — OPFS requires a secure context.';
  }
  if (!caps.hasNavigatorStorage || !caps.hasGetDirectory) {
    return 'Browser does not expose `navigator.storage.getDirectory` (OPFS).';
  }
  if (!caps.hasFileSystemSyncAccessHandle) {
    return 'Browser lacks FileSystemSyncAccessHandle — typically a private/incognito tab in Safari or Firefox.';
  }
  if (caps.rootDirectoryError) {
    return `OPFS root directory unavailable: ${caps.rootDirectoryError}`;
  }
  const msg = (err as { message?: unknown } | null)?.message;
  return typeof msg === 'string' && msg.length > 0 ? msg : 'OPFS install failed (unknown reason).';
}

/**
 * Full, verbose diagnostics for the in-memory fallback: the raw install error
 * (name, message, stack) and the capability probe. Unlike
 * `summarizeFallbackReason`, this hides nothing — it backs the "Advanced"
 * disclosure on the storage-unavailable screen, where the reader is debugging
 * the cause and the SQLite-WASM jargon is exactly what they need.
 */
function describeFallbackDetail(
  err: unknown,
  caps: OpfsCapabilities,
  logTag: string,
  filename: string,
  poolName: string,
): string {
  const e = err as { name?: unknown; message?: unknown; stack?: unknown } | null;
  const lines = [
    `db: ${logTag}`,
    `opfsFile: ${filename}`,
    `pool: ${poolName}`,
    `error.name: ${typeof e?.name === 'string' ? e.name : '(none)'}`,
    `error.message: ${typeof e?.message === 'string' ? e.message : String(err)}`,
    '',
    'capabilities:',
    `  isSecureContext: ${caps.isSecureContext}`,
    `  origin: ${caps.origin ?? '(none)'}`,
    `  navigator.storage: ${caps.hasNavigatorStorage}`,
    `  navigator.storage.getDirectory: ${caps.hasGetDirectory}`,
    `  FileSystemSyncAccessHandle: ${caps.hasFileSystemSyncAccessHandle}`,
    `  rootDirectoryError: ${caps.rootDirectoryError ?? '(none)'}`,
  ];
  if (typeof e?.stack === 'string' && e.stack.length > 0) {
    lines.push('', 'stack:', e.stack);
  }
  return lines.join('\n');
}

async function probeOpfsCapabilities(): Promise<OpfsCapabilities> {
  const g = globalThis as {
    navigator?: { storage?: { getDirectory?: () => Promise<unknown> } };
    isSecureContext?: boolean;
    origin?: string;
    FileSystemSyncAccessHandle?: unknown;
  };
  const out: OpfsCapabilities = {
    hasNavigatorStorage: !!g.navigator?.storage,
    hasGetDirectory: typeof g.navigator?.storage?.getDirectory === 'function',
    hasFileSystemSyncAccessHandle: typeof g.FileSystemSyncAccessHandle === 'function',
    isSecureContext: g.isSecureContext === true,
    origin: g.origin ?? null,
    rootDirectoryError: null,
  };
  if (out.hasGetDirectory) {
    try {
      await g.navigator!.storage!.getDirectory!();
    } catch (e) {
      out.rootDirectoryError = (e as Error).message ?? String(e);
    }
  }
  return out;
}
