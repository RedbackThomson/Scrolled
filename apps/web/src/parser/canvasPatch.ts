// Speed patch for `@tybys/wz`'s `Canvas` utility.
//
// The library decodes each WZ image by calling `Canvas.setPixelColor(rgba, x,
// y)` once per pixel. In browser mode that does:
//
//     const ctx = this._canvas.getContext('2d');
//     const imageData = ctx.createImageData(1, 1);
//     imageData.data[…] = …;
//     ctx.putImageData(imageData, x, y);
//
// On a `HTMLCanvasElement` (main thread, often GPU-accelerated) that's
// acceptable. On an `OffscreenCanvas` running in a Worker — which is how we
// use it — every `putImageData` is a sync round-trip to the canvas backing
// buffer. For a 32×32 icon that's 1,024 ops; multiplied across thousands of
// items it makes extraction unusably slow.
//
// We buffer pixel writes into a single `Uint8ClampedArray`. When the library
// asks for the encoded PNG via `Canvas.getBufferAsync('image/png')` we flush
// the whole buffer with a single `putImageData`, then delegate to the
// library's original encoder.

import { Canvas } from '@tybys/wz';
import { createLogger } from '@/lib/logger';

const log = createLogger('canvas-patch');

const BUFFER = Symbol.for('mge.pixelBuffer');
const DIRTY = Symbol.for('mge.pixelDirty');

interface CanvasInternals {
  _canvas: OffscreenCanvas | null;
  [BUFFER]?: { data: Uint8ClampedArray; w: number; h: number } | null;
  [DIRTY]?: boolean;
}

let patched = false;

export function ensureCanvasPatched(): void {
  if (patched) return;
  patched = true;

  const origGetBufferAsync = Canvas.prototype.getBufferAsync;

  Canvas.prototype.setPixelColor = function (rgba: number, x: number, y: number) {
    const self = this as unknown as CanvasInternals;
    const c = self._canvas;
    if (!c) return this;
    const w = c.width;
    const h = c.height;
    let buf = self[BUFFER];
    if (!buf || buf.w !== w || buf.h !== h) {
      buf = { data: new Uint8ClampedArray(w * h * 4), w, h };
      self[BUFFER] = buf;
    }
    const offset = (y * w + x) * 4;
    buf.data[offset] = (rgba >>> 24) & 0xff;
    buf.data[offset + 1] = (rgba >>> 16) & 0xff;
    buf.data[offset + 2] = (rgba >>> 8) & 0xff;
    buf.data[offset + 3] = rgba & 0xff;
    self[DIRTY] = true;
    return this;
  };

  Canvas.prototype.getBufferAsync = function (mime: string) {
    const self = this as unknown as CanvasInternals;
    flush(self);
    return origGetBufferAsync.call(this, mime);
  };

  log.info('Canvas prototype patched for buffered pixel writes');
}

function flush(self: CanvasInternals): void {
  const buf = self[BUFFER];
  const c = self._canvas;
  if (!self[DIRTY] || !buf || !c) return;
  try {
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // ImageData wants a `Uint8ClampedArray` backed specifically by an
    // `ArrayBuffer` (not `SharedArrayBuffer`). The current TS lib types
    // express that as a stricter `ArrayBufferLike = ArrayBuffer` constraint,
    // so we materialize a fresh ArrayBuffer-backed view from the buffered
    // pixel data.
    const ab = new ArrayBuffer(buf.data.byteLength);
    const view = new Uint8ClampedArray(ab);
    view.set(buf.data);
    ctx.putImageData(new ImageData(view, buf.w, buf.h), 0, 0);
    self[DIRTY] = false;
  } catch (e) {
    log.warn('flush failed', { error: (e as Error).message });
  }
}

/**
 * Render any buffered pixel writes for this Canvas to its underlying
 * OffscreenCanvas. Exposed for decoders that bypass the library's
 * `getBufferAsync` (which goes through `toBlob` + FileReader and can hang
 * unpredictably) and instead encode the OffscreenCanvas directly.
 *
 * Returns the underlying OffscreenCanvas, or `null` if it has been disposed.
 */
export function flushAndGetCanvas(canvas: object): OffscreenCanvas | null {
  ensureCanvasPatched();
  const self = canvas as unknown as CanvasInternals;
  flush(self);
  return self._canvas;
}
