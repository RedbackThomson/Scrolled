import { WzCanvasProperty, WzPngProperty } from '@tybys/wz';
import type { WzObject } from '@tybys/wz';
import { WzImage } from '@tybys/wz';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('icons');

/**
 * Decode a WZ canvas/PNG node into PNG bytes. The Worker side already shims
 * `window.document.createElement('canvas')` to return an OffscreenCanvas (see
 * workerEnv.ts), so the library's Canvas.getBufferAsync works.
 *
 * `node` must already be parsed (the caller is responsible for traversing to
 * it via the per-file lock).
 *
 * Disposing after the byte read is what the library expects and is what
 * actually produces visible icons in practice — keeping the OffscreenCanvas
 * alive (so it can be re-decoded later) regressed icon rendering for reasons
 * I haven't fully pinned down on Firefox. The "second decode crashes with
 * null toBlob" failure mode is sidestepped on the caller side: the main-
 * thread icon URL cache (see `lib/useIcon.ts`) is unbounded and de-duplicates
 * in-flight fetches, so the same canvas should not be decoded twice in a
 * session.
 */
export async function decodePng(node: WzObject): Promise<Uint8Array | null> {
  const canvasNode = await resolveCanvas(node);
  if (!canvasNode) {
    log.warn('decodePng: no canvas-like node', { ctor: node?.constructor?.name });
    return null;
  }
  try {
    const canvas = await canvasNode.getBitmap();
    if (!canvas) {
      log.warn('decodePng: getBitmap returned null', { ctor: canvasNode?.constructor?.name });
      return null;
    }
    const png = await canvas.getBufferAsync('image/png');
    canvas.dispose();
    log.info('decodePng ok', { bytes: png?.byteLength ?? 0 });
    return png;
  } catch (e) {
    log.warn('decodePng failed', describeError(e));
    return null;
  }
}

/**
 * WZ icons usually live at `…/info/icon` as a `WzCanvasProperty`, but some
 * variants wrap a `WzPngProperty` directly, or have an extra inner node. This
 * helper accepts whatever the caller has and returns something we can call
 * `getBitmap()` on.
 */
async function resolveCanvas(node: WzObject): Promise<WzCanvasProperty | WzPngProperty | null> {
  // Some images aren't parsed at the time the caller grabs them. We need to
  // ensure their parent image was parsed already — the per-file lock around
  // resolve() handles that.
  if (node instanceof WzCanvasProperty) return node;
  if (node instanceof WzPngProperty) return node;

  // Look one level deeper. Some skins keep the canvas under a child.
  const child = (node as { at?(name: string): WzObject | null }).at?.('PNG');
  if (child instanceof WzPngProperty) return child;

  return null;
}

/**
 * Best-effort detection: does this object have an icon-decodable child?
 * Used to mark items as having icons without committing to a decode yet.
 */
export function looksLikeIcon(node: WzObject): boolean {
  if (node instanceof WzCanvasProperty) return true;
  if (node instanceof WzPngProperty) return true;
  return false;
}

export { WzImage };
