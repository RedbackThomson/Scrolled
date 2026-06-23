// Chair extractor.
//
// Chairs are Install items whose `.img` carries an `/effect` subtree. The
// generic item extractor already covers their tradeability flags / icon, so
// this pass only collects chair-specific data:
//
//   * recoveryHP / recoveryMP from /info
//   * each /effect/<n> frame's pixels, origin, and delay
//
// It then normalizes all frames to a shared canvas (so the in-game pose stays
// anchored even when individual frames differ in size) and encodes a single
// animated PNG (APNG) that the wiki shows beneath the item header.
//
// Frame pixels come straight from the data source as RGBA (`getIconRgba`), and
// the APNG encoder is pure JS, so the whole path runs the same in the browser
// worker and the headless CLI. The encoder is dependency-injected only so the
// test runner can supply a cheap synthetic one.

import type { GameDataSource, WzNodeInfo } from '../parser';
import type { CanvasPixels } from '@scrolled/wz';
import type { ChairRecord } from '@scrolled/game-db/db';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';
import { nodeToNumber, pathToNumber } from './wzCoerce';
import { encodeAnimatedPng, type AnimFrame, type EncodedAnimation } from '../lib/apng';

const log = createLogger('extract-chairs');

const INSTALL_ROOT = 'Item.wz/Install';

/**
 * Roots `extractItems` consults for Install item names, in priority order.
 * The chair extractor mirrors this list because chairs FK into `items` —
 * if `extractItems` would skip an id for "no localized name", we must skip
 * it here too, or the upsert hits a foreign-key violation.
 */
const STRING_ROOTS: readonly string[] = ['String.wz/Ins.img', 'String.wz/Install.img'];

export interface ExtractChairsResult {
  chairs: ChairRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Boundary the extractor uses to encode the normalized frames into the final
 * animation. Production uses the pure-JS APNG encoder; tests inject a stub that
 * returns predictable bytes without building a real APNG.
 */
export interface ChairImageOps {
  encodeAnimation(frames: AnimFrame[]): Promise<EncodedAnimation> | EncodedAnimation;
}

export const defaultChairImageOps: ChairImageOps = {
  encodeAnimation: encodeAnimatedPng,
};

interface FrameMeta {
  index: number;
  iconPath: string;
  originX: number;
  originY: number;
  delayMs: number;
}

/**
 * How many chairs are in-flight at once during extraction. The per-chair wait
 * is the async WZ canvas inflate behind `getIconRgba` (one per frame); APNG
 * encoding itself is synchronous pure-JS deflate. Keeping several chairs in
 * flight overlaps those inflate waits without unbounded concurrency.
 */
const CHAIR_CONCURRENCY = 8;

export async function extractChairs(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn; ops?: ChairImageOps; concurrency?: number } = {},
): Promise<ExtractChairsResult> {
  const ops = opts.ops ?? defaultChairImageOps;
  const concurrency = Math.max(1, opts.concurrency ?? CHAIR_CONCURRENCY);
  const chairs: ChairRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  // --- Discovery: walk Install/<group>/<id> and keep ids that have /effect.
  const groups = await source.listChildren(INSTALL_ROOT);
  const work: { id: number; node: WzNodeInfo }[] = [];
  for (const group of groups) {
    if (group.kind !== 'image') continue;
    opts.onProgress?.({
      phase: 'Discovering chairs',
      current: work.length,
      detail: group.name,
    });
    const children = await source.listChildren(group.fullPath);
    for (const child of children) {
      const m = child.name.match(/^(\d+)$/);
      if (!m) continue;
      const effectNode = await source.getNode(`${child.fullPath}/effect`);
      if (effectNode) work.push({ id: Number(m[1]), node: child });
    }
  }
  log.info('chair discovery complete', { total: work.length });

  // --- Extraction: process chairs in a concurrency-limited pool. The WZ
  // reads (getNode / listChildren) serialize on the per-image mutex inside
  // the parser, but the image work (PNG decode + WebP encode) dispatches to
  // browser-internal threads, so several chairs encoding in flight overlaps
  // their async time. Order of `chairs[]` doesn't matter — DB upsert is
  // keyed by item_id.
  let next = 0;
  let processed = 0;
  const workerLoop = async () => {
    while (true) {
      const i = next++;
      if (i >= work.length) return;
      const { id, node } = work[i]!;
      try {
        if (!(await hasLocalizedName(source, id))) {
          // Mirrors extractItems' skip behavior so we don't emit a chair row
          // whose item_id won't exist in `items` — the FK would fail at upsert.
          skipped.push({ reason: 'no localized name found', path: node.fullPath });
        } else {
          const record = await readChair(source, id, node, ops);
          if (record) chairs.push(record);
          else skipped.push({ reason: 'no decodable frames', path: node.fullPath });
        }
      } catch (err) {
        log.warn('chair extraction failed', { id, path: node.fullPath, ...describeError(err) });
        skipped.push({ reason: 'extraction error', path: node.fullPath });
      }
      processed += 1;
      opts.onProgress?.({
        phase: 'Extracting chairs',
        current: processed,
        total: work.length,
        detail: String(id),
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, work.length || 1) }, workerLoop),
  );
  opts.onProgress?.({ phase: 'Extracting chairs', current: processed, total: work.length });

  log.info('chair extraction complete', { chairs: chairs.length, skipped: skipped.length });
  return { chairs, skipped };
}

async function hasLocalizedName(source: GameDataSource, id: number): Promise<boolean> {
  for (const root of STRING_ROOTS) {
    const nameNode = await source.getNode(`${root}/${id}/name`);
    if (typeof nameNode?.scalar === 'string' && nameNode.scalar) return true;
  }
  return false;
}

async function readChair(
  source: GameDataSource,
  id: number,
  node: WzNodeInfo,
  ops: ChairImageOps,
): Promise<ChairRecord | null> {
  const itemPath = node.fullPath;

  const info = new Map<string, WzNodeInfo>();
  for (const child of await source.listChildren(`${itemPath}/info`)) info.set(child.name, child);

  const frameMetas = await collectFrameMetas(source, `${itemPath}/effect`);
  if (frameMetas.length === 0) return null;

  // Decode every frame to RGBA first — we need the actual pixel dimensions
  // to compute the shared bounding box, since WZ doesn't store them.
  const decoded = await Promise.all(
    frameMetas.map(async (meta) => {
      const frame = await source.getIconRgba(meta.iconPath);
      if (!frame) return null;
      return { meta, frame };
    }),
  );
  const live = decoded.filter((d): d is { meta: FrameMeta; frame: CanvasPixels } => d !== null);
  if (live.length === 0) return null;

  // Common anchor = the maximum of each origin component across frames. Every
  // frame is then composited at (anchor - origin), guaranteeing the in-game
  // pose lines up across frames of different sizes.
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  for (const { meta, frame } of live) {
    left = Math.max(left, meta.originX);
    right = Math.max(right, frame.width - meta.originX);
    top = Math.max(top, meta.originY);
    bottom = Math.max(bottom, frame.height - meta.originY);
  }
  const canvasWidth = Math.max(1, left + right);
  const canvasHeight = Math.max(1, top + bottom);
  const anchorX = left;
  const anchorY = top;

  const animFrames: AnimFrame[] = live.map(({ meta, frame }) => ({
    rgba: padFrameToCanvas(frame, meta.originX, meta.originY, anchorX, anchorY, canvasWidth, canvasHeight),
    width: canvasWidth,
    height: canvasHeight,
    delayMs: meta.delayMs,
  }));

  const encoded = await ops.encodeAnimation(animFrames);

  return {
    itemId: id,
    recoveryHp: nodeToNumber(info.get('recoveryHP')),
    recoveryMp: nodeToNumber(info.get('recoveryMP')),
    frameCount: animFrames.length,
    previewData: encoded.data,
    previewWidth: encoded.width,
    previewHeight: encoded.height,
  };
}

async function collectFrameMetas(source: GameDataSource, effectPath: string): Promise<FrameMeta[]> {
  const children = await source.listChildren(effectPath);
  const metas: FrameMeta[] = [];
  for (const child of children) {
    const m = child.name.match(/^(\d+)$/);
    if (!m) continue;
    const index = Number(m[1]);
    // WZ uses UOLs to share frame data — e.g. `/effect/3` is a UOL pointing
    // at `/effect/0`. `getIconPng` follows UOLs internally, but the parser
    // surfaces the UOL itself as a childless leaf, so `…/origin` and `…/delay`
    // would silently fall back to defaults and the frame would render at the
    // wrong position. Resolve the UOL target up front so origin/delay come
    // from the real frame.
    const framePath =
      child.propertyKind === 'uol' && typeof child.scalar === 'string'
        ? resolveRelativePath(child.fullPath, child.scalar)
        : child.fullPath;
    const originNode = await source.getNode(`${framePath}/origin`);
    const { x: originX, y: originY } = parseVector(originNode?.scalar) ?? { x: 0, y: 0 };
    const delay = (await pathToNumber(source, `${framePath}/delay`)) ?? 100;
    metas.push({ index, iconPath: framePath, originX, originY, delayMs: delay });
  }
  metas.sort((a, b) => a.index - b.index);
  return metas;
}

function resolveRelativePath(fromFullPath: string, target: string): string {
  const segments = fromFullPath.split('/');
  segments.pop();
  for (const seg of target.split('/').filter(Boolean)) {
    if (seg === '..') segments.pop();
    else segments.push(seg);
  }
  return segments.join('/');
}

function parseVector(scalar: unknown): { x: number; y: number } | null {
  if (typeof scalar !== 'string') return null;
  const m = scalar.match(/^(-?\d+),(-?\d+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

function padFrameToCanvas(
  frame: CanvasPixels,
  originX: number,
  originY: number,
  anchorX: number,
  anchorY: number,
  canvasWidth: number,
  canvasHeight: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  const dx = anchorX - originX;
  const dy = anchorY - originY;
  for (let y = 0; y < frame.height; y++) {
    const cy = dy + y;
    if (cy < 0 || cy >= canvasHeight) continue;
    const srcRowStart = y * frame.width * 4;
    const dstRowStart = cy * canvasWidth * 4 + dx * 4;
    // Clip horizontally — guard against negative dx or right-edge overflow
    // so a misaligned frame doesn't corrupt the canvas buffer.
    const clipLeft = dx < 0 ? -dx : 0;
    const clipRight = Math.max(0, dx + frame.width - canvasWidth);
    const copyWidth = frame.width - clipLeft - clipRight;
    if (copyWidth <= 0) continue;
    out.set(
      frame.rgba.subarray(srcRowStart + clipLeft * 4, srcRowStart + (frame.width - clipRight) * 4),
      dstRowStart + clipLeft * 4,
    );
  }
  return out;
}
