import { createLogger } from '@scrolled/game-db/lib/logger';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';

const log = createLogger('to-bytes');

/**
 * Buffer a source into a `Uint8Array`. A browser `File` is streamed (with
 * progress); a string is treated as a Node filesystem path (vitest only — the
 * dynamic import keeps `node:fs` out of the browser bundle).
 */
export async function toBytes(
  input: File | string,
  logName: string,
  onProgress?: ProgressFn,
): Promise<Uint8Array> {
  if (typeof input === 'string') {
    const { readFile } = await import('node:fs/promises');
    const buf = await readFile(input);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const started = performance.now();
  const total = input.size;
  let buf: Uint8Array;
  if (typeof input.stream === 'function') {
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
    buf = new Uint8Array(await input.arrayBuffer());
  }
  log.info('buffered file into memory', {
    name: logName,
    bytes: buf.byteLength,
    ms: Math.round(performance.now() - started),
  });
  return buf;
}
