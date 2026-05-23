/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('hash-worker');
log.info('hash worker started');

export interface HashApi {
  /**
   * SHA-256 of a File or Blob. Returns lowercase hex.
   *
   * The worker reads the entire payload via `arrayBuffer()` (single
   * allocation, no JS-side chunk coalescing), then hands the buffer to
   * `crypto.subtle.digest`, which the browser pipes to its native SHA-256
   * implementation (HW-accelerated on every platform we target).
   */
  sha256(file: Blob): Promise<string>;
}

const api: HashApi = {
  async sha256(file: Blob): Promise<string> {
    const t0 = performance.now();
    try {
      const buf = await file.arrayBuffer();
      const tRead = performance.now();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const tHash = performance.now();
      const hex = toHex(new Uint8Array(digest));
      log.info('hashed', {
        size: file.size,
        readMs: Math.round(tRead - t0),
        digestMs: Math.round(tHash - tRead),
        totalMs: Math.round(performance.now() - t0),
      });
      return hex;
    } catch (e) {
      log.error('sha256 failed', describeError(e));
      throw e;
    }
  },
};

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

expose(api);
