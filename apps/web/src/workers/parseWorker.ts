/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { WzDataSource } from '@/parser/WzDataSource';
import { ImgDataSource } from '@/parser/ImgDataSource';
import { ensureWzInit } from '@/parser/wzInit';
import {
  extractItems,
  extractEquips,
  extractMobs,
  extractNpcs,
  extractMaps,
  extractQuests,
  extractSkills,
  extractJobs,
} from '@/extractors';
import { createLogger, describeError } from '@/lib/logger';
import { throttleProgress, type ProgressFn } from '@/lib/progress';
import type {
  DataSourceKind,
  GameDataSource,
  LoadFileSpec,
  WzMapleVersionName,
} from '@/parser/types';
import type {
  ExtractItemsResult,
  ExtractEquipsResult,
  ExtractMobsResult,
  ExtractNpcsResult,
  ExtractMapsResult,
  ExtractQuestsResult,
  ExtractSkillsResult,
  ExtractJobsResult,
} from '@/extractors';

const log = createLogger('worker');
log.info('worker started');

class WorkerGameDataSource implements GameDataSource {
  // Picked on `init` based on the dataset kind. Both implement the same
  // `GameDataSource` contract, so every method below — and the extractors —
  // are format-agnostic.
  private inner: GameDataSource | null = null;

  async init(version: WzMapleVersionName, kind: DataSourceKind = 'wz') {
    log.info('init requested', { version, kind });
    try {
      await ensureWzInit();
    } catch (e) {
      log.error('ensureWzInit failed', describeError(e));
      throw e;
    }
    this.inner = kind === 'img' ? new ImgDataSource() : new WzDataSource();
    await this.inner.init(version, kind);
  }
  private src(): GameDataSource {
    if (!this.inner) throw new Error('parser worker used before init()');
    return this.inner;
  }
  load(files: LoadFileSpec[], onProgress?: ProgressFn) {
    return this.src().load(files, onProgress ? throttleProgress(onProgress) : undefined);
  }
  getNode(path: string) {
    return this.src().getNode(path);
  }
  listChildren(path: string) {
    return this.src().listChildren(path);
  }
  readImageTree(path: string, opts?: { subtrees?: string[]; maxDepth?: number }) {
    return this.src().readImageTree(path, opts);
  }
  listFiles() {
    return this.src().listFiles();
  }
  getIconPng(path: string) {
    return this.src().getIconPng(path);
  }
  diagnose() {
    return this.src().diagnose();
  }
  dispose() {
    return this.src().dispose();
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
    const result = await extractItems(this.src(), {
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
    const result = await extractEquips(this.src(), {
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
    const result = await extractMobs(this.src(), {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractMobs complete', { mobs: result.mobs.length, skipped: result.skipped.length });
    return result;
  }

  async extractNpcs(onProgress?: ProgressFn): Promise<ExtractNpcsResult> {
    log.info('extractNpcs requested');
    const result = await extractNpcs(this.src(), {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractNpcs complete', { npcs: result.npcs.length, skipped: result.skipped.length });
    return result;
  }

  async extractMaps(onProgress?: ProgressFn): Promise<ExtractMapsResult> {
    log.info('extractMaps requested');
    const result = await extractMaps(this.src(), {
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
    const result = await extractQuests(this.src(), {
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

  async extractJobs(onProgress?: ProgressFn): Promise<ExtractJobsResult> {
    log.info('extractJobs requested');
    const result = await extractJobs(this.src(), {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractJobs complete', { jobs: result.jobs.length, skipped: result.skipped.length });
    return result;
  }

  async extractSkills(onProgress?: ProgressFn): Promise<ExtractSkillsResult> {
    log.info('extractSkills requested');
    const result = await extractSkills(this.src(), {
      onProgress: onProgress ? throttleProgress(onProgress) : undefined,
    });
    log.info('extractSkills complete', {
      skills: result.skills.length,
      levels: result.levels.length,
      prerequisites: result.prerequisites.length,
      skipped: result.skipped.length,
    });
    return result;
  }
}

expose(new WorkerGameDataSource());
