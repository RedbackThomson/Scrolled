import {
  WzFile,
  WzImage,
  WzDirectory,
  WzFileParseStatus,
  ErrorLogger,
  getErrorDescription,
  type WzObject,
  type WzError,
} from '@tybys/wz';
import type {
  Diagnostics,
  GameDataSource,
  LoadFileSpec,
  LoadResult,
  WzMapleVersionName,
  WzNodeInfo,
} from './types';
import { toWzMapleVersion } from './wzVersion';
import { toNodeInfo, WzSubProperty, WzConvexProperty } from './nodeInfo';
import { decodePng } from './icons';
import { createLogger, describeError, getLogEntries } from '@/lib/logger';
import { getAesSmokeTestResult } from './wzInit';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('wz-data-source');

interface LoadedFile {
  name: string;
  file: WzFile;
  /**
   * Tail of a promise chain used to serialize all reader-touching operations
   * within this file. `@tybys/wz`'s `WzImage` instances share a single
   * `WzBinaryReader` per `WzFile`, and that reader carries a mutable `pos`
   * that advances on every read. Two concurrent `parseImage()` calls — or a
   * `parseImage` racing a manual `reader.read()` for diagnostics — trample
   * each other's positions between awaits, so byte reads come back from the
   * wrong offsets and decryption silently produces garbage strings. Holding
   * a per-file lock around every reader operation is the simplest fix.
   */
  lock: Promise<unknown>;
}

function runExclusive<T>(file: LoadedFile, fn: () => Promise<T>): Promise<T> {
  const next = file.lock.then(fn, fn);
  // Keep the chain alive even on failure; subsequent ops should still run.
  file.lock = next.catch(() => undefined);
  return next;
}

/**
 * Parser implementation backed by `@tybys/wz`. Holds open `WzFile` instances
 * keyed by logical name (e.g. "String.wz", "Item.wz") and resolves paths
 * formatted as `<file>/<segments…>`.
 *
 * Path conventions:
 *   - "" or "/" → the source root (list of loaded files)
 *   - "String.wz" → the WzFile root
 *   - "String.wz/Eqp.img" → an image inside the file
 *   - "String.wz/Eqp.img/Eqp/Cap/1002000/name" → a property
 */
export class WzDataSource implements GameDataSource {
  private version: WzMapleVersionName = 'BMS';
  private readonly files = new Map<string, LoadedFile>();

  async init(version: WzMapleVersionName): Promise<void> {
    log.info('init', { version });
    this.version = version;
  }

  async load(files: LoadFileSpec[], onProgress?: ProgressFn): Promise<LoadResult> {
    const loaded: LoadResult['loaded'] = [];
    const errors: LoadResult['errors'] = [];

    drainLibraryErrors();

    for (const spec of files) {
      const size = typeof spec.source !== 'string' ? spec.source.size : undefined;
      log.info('loading file', { name: spec.name, size, version: this.version });
      try {
        // Buffer the entire File into memory before handing it to the library.
        // The library's underlying `AsyncBinaryReader` has two code paths:
        // a synchronous in-memory `Uint8Array` path, and an async per-read
        // `FileReader` path that allocates a new FileReader for every byte.
        // The FileReader path adds an event-loop turn to every read; an image
        // like `Consume.img` with ~2,500 entries means tens of thousands of
        // reads which can take minutes. The Uint8Array path resolves the same
        // parse in milliseconds. The TS types claim `string | File` only, but
        // the runtime accepts `Uint8Array` — see binreader's AsyncBinaryReader
        // constructor.
        //
        // Memory: this buffers the whole file. Fine for files up to a few
        // hundred MB (Item.wz is ~96 MB, String.wz ~5 MB on MapleRoyals).
        // Map.wz (~880 MB) and Character.wz (~800 MB) will need a different
        // strategy when those phases land.
        const source = await this.toSource(spec.source, spec.name, onProgress);
        if (onProgress) {
          onProgress({
            phase: `Parsing ${spec.name}`,
            current: 0,
            total: 0,
            detail: 'reading header',
          });
        }
        const file = new WzFile(source, toWzMapleVersion(this.version));
        const status = await file.parseWzFile();
        if (status !== WzFileParseStatus.SUCCESS) {
          const msg = `parseWzFile failed: ${getErrorDescription(status)} (status ${status})`;
          log.error('parseWzFile failed', { name: spec.name, status, message: msg });
          errors.push({ name: spec.name, message: msg });
          continue;
        }
        this.files.set(spec.name, { name: spec.name, file, lock: Promise.resolve() });
        const rootDirectories: string[] = [];
        const root = file.wzDirectory;
        if (root) {
          for (const d of root.wzDirectories) rootDirectories.push(d.name);
          for (const img of root.wzImages) rootDirectories.push(img.name);
        }
        log.info('file loaded', {
          name: spec.name,
          rootCount: rootDirectories.length,
          rootHead: rootDirectories.slice(0, 5),
        });
        loaded.push({ name: spec.name, rootDirectories });
      } catch (err) {
        log.error('exception during load', { name: spec.name, ...describeError(err) });
        errors.push({ name: spec.name, message: (err as Error).message });
      }
    }

    const libErrors = drainLibraryErrors();
    if (libErrors.length > 0) {
      log.warn('library reported errors after load', {
        count: libErrors.length,
        samples: libErrors.slice(0, 5),
      });
    }
    return { loaded, errors };
  }

  async listFiles(): Promise<WzNodeInfo[]> {
    return [...this.files.values()].map((f) => ({
      name: f.name,
      fullPath: f.name,
      kind: 'file',
      hasChildren: f.file.wzDirectory !== null,
    }));
  }

  async getNode(path: string): Promise<WzNodeInfo | null> {
    log.debug('getNode', { path });
    const loaded = this.loadedFor(path);
    if (!loaded) return null;
    return runExclusive(loaded, async () => {
      const obj = await this.resolveInLock(loaded, path);
      if (!obj) {
        log.debug('getNode miss', { path });
        return null;
      }
      return toNodeInfo(obj, path);
    });
  }

  async listChildren(path: string): Promise<WzNodeInfo[]> {
    log.debug('listChildren', { path });
    if (!path || path === '/') return this.listFiles();
    const loaded = this.loadedFor(path);
    if (!loaded) return [];

    return runExclusive(loaded, async () => {
      const obj = await this.resolveInLock(loaded, path);
      if (!obj) {
        log.debug('listChildren miss', { path });
        return [];
      }

      const base = path.replace(/\/+$/, '');
      const join = (name: string) => `${base}/${name}`;

      if (obj instanceof WzFile) {
        const root = obj.wzDirectory;
        if (!root) return [];
        return [...root.wzDirectories, ...root.wzImages].map((c) => toNodeInfo(c, join(c.name)));
      }
      if (obj instanceof WzDirectory) {
        return [...obj.wzDirectories, ...obj.wzImages].map((c) => toNodeInfo(c, join(c.name)));
      }
      if (obj instanceof WzImage) {
        const result = await tryParseImage(obj, path);
        if (!result.ok) return [];
        return [...obj.wzProperties].map((c) => toNodeInfo(c, join(c.name)));
      }
      if (obj instanceof WzSubProperty || obj instanceof WzConvexProperty) {
        const props = (obj as unknown as { wzProperties: Set<{ name: string }> }).wzProperties;
        return [...props].map((c) => toNodeInfo(c as unknown as WzObject, join(c.name)));
      }
      return [];
    });
  }

  async getIconPng(path: string): Promise<Uint8Array | null> {
    log.info('getIconPng', { path });
    const loaded = this.loadedFor(path);
    if (!loaded) {
      log.warn('getIconPng: file not loaded for path', {
        path,
        loadedFiles: [...this.files.keys()],
      });
      return null;
    }
    return runExclusive(loaded, async () => {
      const obj = await this.resolveInLock(loaded, path);
      if (!obj) {
        log.warn('getIconPng: path did not resolve', { path });
        return null;
      }
      const bytes = await decodePng(obj);
      log.info('getIconPng done', { path, bytes: bytes?.byteLength ?? 0 });
      return bytes;
    });
  }

  async diagnose(): Promise<Diagnostics> {
    return {
      log: getLogEntries(),
      aesSmokeTest: getAesSmokeTestResult(),
      loadedFiles: [...this.files.keys()].map((name) => ({ name })),
    };
  }

  async dispose(): Promise<void> {
    log.info('dispose', { count: this.files.size });
    for (const { file } of this.files.values()) {
      try {
        file.dispose();
      } catch {
        // best effort
      }
    }
    this.files.clear();
  }

  private async toSource(
    input: File | string,
    logName: string,
    onProgress?: ProgressFn,
  ): Promise<File | string> {
    if (typeof input === 'string') return input;
    const started = performance.now();
    const total = input.size;

    let buf: Uint8Array;
    if (typeof input.stream === 'function') {
      // Stream the File so we can emit byte-level progress.
      const chunks: Uint8Array[] = [];
      let read = 0;
      const reader = input.stream().getReader();
      const phase = `Loading ${logName}`;
      onProgress?.({ phase, current: 0, total });
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          read += value.byteLength;
          onProgress?.({ phase, current: read, total });
        }
      }
      buf = new Uint8Array(read);
      let offset = 0;
      for (const c of chunks) {
        buf.set(c, offset);
        offset += c.byteLength;
      }
    } else {
      // Fallback (no streaming): single-shot arrayBuffer.
      buf = new Uint8Array(await input.arrayBuffer());
    }

    log.info('buffered file into memory', {
      name: logName,
      bytes: buf.byteLength,
      ms: Math.round(performance.now() - started),
    });
    // Cast: the library accepts Uint8Array at runtime even though the TS
    // signature is `string | File`.
    return buf as unknown as File;
  }

  private loadedFor(path: string): LoadedFile | null {
    if (!path || path === '/') return null;
    const [fileName] = path.split('/').filter(Boolean);
    if (!fileName) return null;
    return this.files.get(fileName) ?? null;
  }

  /**
   * Resolve a slash-separated path. Caller must already hold the file lock —
   * this walks the tree and may invoke `parseImage()`, both of which mutate
   * the file's shared `WzBinaryReader`.
   */
  private async resolveInLock(loaded: LoadedFile, path: string): Promise<WzObject | null> {
    const segments = path.split('/').filter(Boolean);
    const [, ...rest] = segments;
    let current: WzObject = loaded.file;
    for (const segment of rest) {
      if (current instanceof WzImage) {
        const result = await tryParseImage(current, path);
        if (!result.ok) return null;
      }
      const next = (current as { at(name: string): WzObject | null }).at(segment);
      if (!next) return null;
      current = next;
    }
    return current;
  }
}

async function tryParseImage(
  img: WzImage,
  contextPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (img.parsed) return { ok: true };
  drainLibraryErrors();

  // Diagnostic: read 16 raw bytes at img.offset before parsing, so we can see
  // whether the library is seeing the expected `0x73` ('s', WzImage header
  // without offset) or `0x01` (Lua image) byte at the documented position.
  // Garbage here means either img.offset is wrong or the File-backed reader
  // is returning wrong bytes. Real header byte is unencrypted — no AES needed
  // to spot a mismatch.
  await captureImageHeaderBytes(img, contextPath);

  try {
    const ok = await img.parseImage();
    const libErrors = drainLibraryErrors();
    if (!ok || !img.parsed) {
      log.warn('parseImage returned false', {
        path: contextPath,
        image: img.name,
        offset: img.offset,
        libraryErrors: libErrors,
      });
      return { ok: false, error: libErrors[0]?.message ?? 'parseImage returned false' };
    }
    if (libErrors.length > 0) {
      log.warn('parseImage succeeded with library warnings', {
        path: contextPath,
        image: img.name,
        warnings: libErrors,
      });
    }
    return { ok: true };
  } catch (err) {
    log.error('parseImage threw', {
      path: contextPath,
      image: img.name,
      ...describeError(err),
      libraryErrors: drainLibraryErrors(),
    });
    return { ok: false, error: (err as Error).message };
  }
}

async function captureImageHeaderBytes(img: WzImage, contextPath: string): Promise<void> {
  try {
    const reader = (
      img as unknown as { reader: { pos: number; read(len?: number): Promise<Uint8Array> } }
    ).reader;
    const savedPos = reader.pos;
    reader.pos = img.offset;
    const head = await reader.read(16);
    reader.pos = savedPos;
    const bytes = Array.from(head)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const headerByte = head[0];
    const interpretation =
      headerByte === 0x73
        ? 'WzImageHeaderByte_WithoutOffset (Property image)'
        : headerByte === 0x01
          ? 'Lua image header'
          : headerByte === 0x1b
            ? 'WzImageHeaderByte_WithOffset (offset image)'
            : 'UNKNOWN — expected 0x73 / 0x01 / 0x1B';
    log.info('image header bytes', {
      path: contextPath,
      image: img.name,
      offset: img.offset,
      headerByte: headerByte !== undefined ? `0x${headerByte.toString(16).padStart(2, '0')}` : null,
      interpretation,
      first16: bytes,
    });
  } catch (e) {
    log.warn('failed to capture image header bytes', {
      path: contextPath,
      image: img.name,
      ...describeError(e),
    });
  }
}

/**
 * `@tybys/wz` accumulates non-fatal parse errors in a static `ErrorLogger`.
 * `_errorList` is marked private in the .d.ts but is accessible at runtime;
 * we drain it after each operation so the diagnostics log shows what the
 * library actually complained about.
 */
function drainLibraryErrors(): { level: number; message: string }[] {
  const list = (ErrorLogger as unknown as { _errorList: Set<WzError> })._errorList;
  if (!list || list.size === 0) return [];
  const out: { level: number; message: string }[] = [];
  for (const err of list) out.push({ level: err.level, message: err.message });
  ErrorLogger.clearErrors();
  return out;
}
