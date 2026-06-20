import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clamp } from '@scrolled/game-db/lib/math';
import { bytesToUrl } from '@/lib/blob';
import { cn } from '@/lib/utils';
import type { GraphicViewerView } from './types';

interface GraphicViewerCanvasProps {
  /** Background image bytes (PNG). A fresh `Uint8Array` per query is fine —
   *  the blob URL is keyed by reference. */
  image: Uint8Array | null;
  ariaLabel: string;
  /** Shown centred when `image` is null (e.g. "This map has no minimap"). */
  unavailableMessage?: string;
  /** Shown while the image's natural size is being measured. */
  loadingMessage?: string;
  /** Re-centres the highlighted overlay in the viewport when this changes. */
  scrollKey?: string | number | null;
  /** Overlays positioned in image-pixel space. Rendered inside the scaled
   *  container so icons sit atop the image and counter-scale via `view.scale`. */
  children: (view: GraphicViewerView) => ReactNode;
}

// Picks the largest integer multiplier (1..MAX_SCALE) such that the scaled
// image is at least TARGET_MIN px on its longer side. Keeps tiny images from
// being too small while not over-blowing already-large ones.
const MAX_SCALE = 6;
const TARGET_MIN = 800;
function pickScale(width: number, height: number): number {
  const longer = Math.max(width, height);
  if (longer <= 0) return 1;
  const ratio = TARGET_MIN / longer;
  return clamp(Math.ceil(ratio), 1, MAX_SCALE);
}

// User zoom bounds, relative to the fitted base scale.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
// Breathing room left around the image when fitting it to the viewport.
const FIT_PADDING = 24;

export function GraphicViewerCanvas({
  image,
  ariaLabel,
  unavailableMessage = 'No image available.',
  loadingMessage = 'Loading…',
  scrollKey,
  children,
}: GraphicViewerCanvasProps) {
  // Build a blob URL once per image blob (keyed by reference, not content).
  const blobUrl = useMemo(() => (image ? bytesToUrl(image, 'image/png') : null), [image]);
  useEffect(() => {
    if (!blobUrl) return;
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  // Measure the PNG's natural pixel dimensions. Overlay projections are
  // expressed in this same pixel space, so anchoring layout to the measured
  // size keeps icons and image in lockstep.
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!blobUrl) {
      setImgSize(null);
      return;
    }
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      setImgSize({ w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.src = blobUrl;
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // View transform: the content's top-left lives at `pan` (container px) and is
  // drawn at `baseScale * zoom`. `baseScale` fits the image to the viewport on
  // load; `zoom` is the user's wheel/pinch multiplier on top of that.
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Refs mirror the live values so the imperative pointer/wheel handlers don't
  // capture stale state.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const baseScaleRef = useRef(baseScale);
  baseScaleRef.current = baseScale;
  const imgSizeRef = useRef(imgSize);
  imgSizeRef.current = imgSize;
  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  // Keep the image anchored to the viewport: lock to centre on any axis where
  // it's smaller than the container, otherwise stop the edges from pulling
  // inside the frame. This both centres a fully-visible image (so it reads as
  // "fit to the container") and bounds dragging/zoom when it overflows.
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const img = imgSizeRef.current;
    const cont = containerSizeRef.current;
    if (!img || !cont) return { x, y };
    const contentW = img.w * scale;
    const contentH = img.h * scale;
    return {
      x: contentW <= cont.w ? (cont.w - contentW) / 2 : clamp(x, cont.w - contentW, 0),
      y: contentH <= cont.h ? (cont.h - contentH) / 2 : clamp(y, cont.h - contentH, 0),
    };
  }, []);

  // (Re)fit and centre whenever a new image loads and the viewport is measured.
  const initedFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!blobUrl || !imgSize || !containerSize) return;
    if (initedFor.current === blobUrl) return;
    initedFor.current = blobUrl;
    const fitW = (containerSize.w - FIT_PADDING * 2) / imgSize.w;
    const fitH = (containerSize.h - FIT_PADDING * 2) / imgSize.h;
    // Never upscale past the crisp integer multiplier; shrink large images to
    // fit. `Math.max(…, 0.01)` guards a zero-sized container before measure.
    const base = Math.max(0.01, Math.min(pickScale(imgSize.w, imgSize.h), fitW, fitH));
    setBaseScale(base);
    setZoom(1);
    setPan({
      x: (containerSize.w - imgSize.w * base) / 2,
      y: (containerSize.h - imgSize.h * base) / 2,
    });
  }, [blobUrl, imgSize, containerSize]);
  useEffect(() => {
    if (!blobUrl) initedFor.current = null;
  }, [blobUrl]);

  // Zoom by `factor` while keeping the (clientX, clientY) point under the
  // cursor fixed. `baseScale` cancels out, so the maths is purely on `zoom`.
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const old = zoomRef.current;
    const next = clamp(old * factor, MIN_ZOOM, MAX_ZOOM);
    if (next === old) return;
    const k = next / old;
    const p = panRef.current;
    setPan(clampPan(cx - (cx - p.x) * k, cy - (cy - p.y) * k, baseScaleRef.current * next));
    setZoom(next);
  }, [clampPan]);

  // Wheel zoom needs a non-passive listener so we can suppress page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Pointer gestures: single pointer on the background pans; two pointers
  // pinch-zoom around their midpoint. Pointers landing on an overlay icon are
  // left alone so taps/clicks still reach it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      drag.current = null;
      setDragging(false);
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current };
      return;
    }
    const target = e.target as HTMLElement;
    const onBackground = target === containerRef.current || target.hasAttribute('data-pan-bg');
    if (!onBackground) return;
    drag.current = { startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    setDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pinch.current && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current.dist === 0) return;
        const next = clamp(pinch.current.zoom * (dist / pinch.current.dist), MIN_ZOOM, MAX_ZOOM);
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const midX = (a.x + b.x) / 2 - rect.left;
        const midY = (a.y + b.y) / 2 - rect.top;
        const k = next / zoomRef.current;
        const p = panRef.current;
        setPan(clampPan(midX - (midX - p.x) * k, midY - (midY - p.y) * k, baseScaleRef.current * next));
        setZoom(next);
        return;
      }
      if (drag.current) {
        const d = drag.current;
        const scale = baseScaleRef.current * zoomRef.current;
        setPan(clampPan(d.panX + (e.clientX - d.startX), d.panY + (e.clientY - d.startY), scale));
      }
    },
    [clampPan],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      setDragging(false);
    }
  }, []);

  // Re-centre the highlighted overlay in the viewport when `scrollKey` changes,
  // preserving the current zoom.
  useLayoutEffect(() => {
    if (scrollKey == null) return;
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('[data-highlighted="true"]');
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const ecx = eRect.left + eRect.width / 2 - cRect.left;
    const ecy = eRect.top + eRect.height / 2 - cRect.top;
    const scale = baseScaleRef.current * zoomRef.current;
    // Clamped, so a fully-visible image stays centred rather than panning the
    // highlight to the middle and exposing empty space.
    setPan((p) => clampPan(p.x + (cRect.width / 2 - ecx), p.y + (cRect.height / 2 - ecy), scale));
    // `baseScale` is included so a highlight present on first open re-centres
    // once the initial fit has run (it only changes on (re)fit, not on zoom).
  }, [scrollKey, baseScale, clampPan]);

  const width = imgSize?.w ?? 0;
  const height = imgSize?.h ?? 0;
  const effectiveScale = baseScale * zoom;

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted/30 relative flex-1 select-none overflow-hidden',
        imgSize && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
      )}
      role="img"
      aria-label={ariaLabel}
      // We drive every gesture ourselves; opt out of the browser's own
      // pan/zoom so it doesn't fight the transform.
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!blobUrl ? (
        <Message>{unavailableMessage}</Message>
      ) : !imgSize ? (
        <Message>{loadingMessage}</Message>
      ) : (
        <div
          data-pan-bg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${effectiveScale})`,
            transformOrigin: 'top left',
          }}
        >
          <img
            data-pan-bg
            src={blobUrl}
            width={width}
            height={height}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'block',
              imageRendering: 'pixelated',
            }}
          />
          {children({ imageSize: { w: width, h: height }, scale: effectiveScale })}
        </div>
      )}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-6 text-sm">
      {children}
    </div>
  );
}
