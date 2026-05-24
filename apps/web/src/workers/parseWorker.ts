/// <reference lib="WebWorker" />
// IMPORTANT: this side-effect import must come first. It aliases `window` to
// the Worker global so `@tybys/wz` modules don't throw at load time. See
// workerEnv.ts for details.
import './workerEnv';
import { expose } from 'comlink';
import { WzDataSource } from '@/parser/WzDataSource';
import { ensureWzInit } from '@/parser/wzInit';
import {
  extractItems,
  extractEquips,
  extractMobs,
  extractNpcs,
  extractMaps,
  extractQuests,
} from '@/extractors';
import { createLogger, describeError } from '@/lib/logger';
import { throttleProgress, type ProgressFn } from '@/lib/progress';
import type { GameDataSource, LoadFileSpec, WzMapleVersionName } from '@/parser/types';
import type {
  ExtractItemsResult,
  ExtractEquipsResult,
  ExtractMobsResult,
  ExtractNpcsResult,
  ExtractMapsResult,
  ExtractQuestsResult,
} from '@/extractors';

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
  readImageTree(path: string, opts?: { subtrees?: string[]; maxDepth?: number }) {
    return this.inner.readImageTree(path, opts);
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

  async extractMobs(onProgress?: ProgressFn): Promise<ExtractMobsResult> {
    log.info('extractMobs requested');
    const result = await extractMobs(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractMobs complete', { mobs: result.mobs.length, skipped: result.skipped.length });
    return result;
  }

  async extractNpcs(onProgress?: ProgressFn): Promise<ExtractNpcsResult> {
    log.info('extractNpcs requested');
    const result = await extractNpcs(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractNpcs complete', { npcs: result.npcs.length, skipped: result.skipped.length });
    return result;
  }

  async extractMaps(onProgress?: ProgressFn): Promise<ExtractMapsResult> {
    log.info('extractMaps requested');
    const result = await extractMaps(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractMaps complete', {
      maps: result.maps.length,
      mapNpcs: result.mapNpcs.length,
      mapMobs: result.mapMobs.length,
      mapPortals: result.mapPortals.length,
    });
    return result;
  }

  async extractQuests(onProgress?: ProgressFn): Promise<ExtractQuestsResult> {
    log.info('extractQuests requested');
    const result = await extractQuests(this.inner, {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractQuests complete', {
      quests: result.quests.length,
      requirements: result.requirements.length,
      rewards: result.rewards.length,
      skipped: result.skipped.length,
    });
    return result;
  }
}

expose(new WorkerGameDataSource());
