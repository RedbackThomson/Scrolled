/// <reference lib="WebWorker" />
// IMPORTANT: this side-effect import must come first. It aliases `window` to
// the Worker global so `@tybys/wz` modules don't throw at load time. See
// workerEnv.ts for details.
import './workerEnv';
import { expose } from 'comlink';
import { WzDataSource } from '@/parser/WzDataSource';
import { ensureWzInit } from '@/parser/wzInit';
import { extractItems, extractEquips } from '@/extractors';
import { createLogger, describeError } from '@/lib/logger';
import { throttleProgress, type ProgressFn } from '@/lib/progress';
import type { GameDataSource, LoadFileSpec, WzMapleVersionName } from '@/parser/types';
import type { ExtractItemsResult, ExtractEquipsResult } from '@/extractors';

const log = createLogger('worker');
log.info('worker started');

class WorkerGameDataSource implements GameDataSource {
  private readonly inner = new WzDataSource();

  async init(version: WzMapleVersionName) {
    log.info('init requested', { version });
    try {
      await ensureWzInit();
    } catch (e) {
      log.error('ensureWzInit failed', describeError(e));
      throw e;
    }
    await this.inner.init(version);
  }
  load(files: LoadFileSpec[], onProgress?: ProgressFn) {
    return this.inner.load(files, onProgress ? throttleProgress(onProgress) : undefined);
  }
  getNode(path: string) {
    return this.inner.getNode(path);
  }
  listChildren(path: string) {
    return this.inner.listChildren(path);
  }
  listFiles() {
    return this.inner.listFiles();
  }
  getIconPng(path: string) {
    return this.inner.getIconPng(path);
  }
  diagnose() {
    return this.inner.diagnose();
  }
  dispose() {
    return this.inner.dispose();
  }

  /**
   * Worker-side extractors. Calling these directly avoids one comlink hop per
   * node read — the extractor stays in the worker and only crosses the
   * boundary with the final batch.
   *
   * `onProgress` is a comlink-proxied callback from the main thread. Each
   * invocation is a message back across the boundary, so we throttle to ~80ms
   * to keep the UI smooth without paying per-item overhead.
   */
  async extractItems(onProgress?: ProgressFn): Promise<ExtractItemsResult> {
    log.info('extractItems requested');
    const result = await extractItems(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractItems complete', {
      items: result.items.length,
      skipped: result.skipped.length,
    });
    return result;
  }

  async extractEquips(onProgress?: ProgressFn): Promise<ExtractEquipsResult> {
    log.info('extractEquips requested');
    const result = await extractEquips(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractEquips complete', {
      equips: result.equips.length,
      skipped: result.skipped.length,
    });
    return result;
  }
}

expose(new WorkerGameDataSource());
