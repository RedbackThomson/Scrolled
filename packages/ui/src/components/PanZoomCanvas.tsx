// Generic pan/zoom surface used by image viewers and the future Navigator
// graph view. Owns the container, the scaled transform, pointer/wheel/pinch
// gestures, and the recentre-on-key behaviour. Knows nothing about images —
// content is supplied as a render prop in content-pixel space.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

export interface PanZoomView {
  /** Natural content size in CSS pixels. */
  contentSize: { w: number; h: number };
  /** Live scale (baseScale * zoom). Overlays counter-scale via `1 / view.scale`. */
  scale: number;
}

export interface PanZoomCanvasProps {
  /**
   * Content's natural pixel size, or null if no content is available (the
   * canvas then renders only the placeholder).
   */
  contentSize: { w: number; h: number } | null;
  /**
   * Rendered centred inside the canvas while `contentSize` is null. Use this
   * for "loading…" / "no content" messages — the canvas knows nothing about
   * what those states mean.
   */
  placeholder?: ReactNode;
  /**
   * Cap on the initial fit scale. Defaults to 1 (no upscale — content shown
   * at natural size or smaller). Image viewers can pass a higher value (e.g.
   * a crisp pixel-art multiplier) so small images fill more of the viewport.
   */
  maxBaseScale?: number;
  /**
   * Re-centre the descendant matching [data-highlighted="true"] in the
   * viewport when this changes.
   */
  scrollKey?: string | number | null;
  /** Extra classes applied to the outer container. */
  className?: string;
  /** Accessible label for the canvas. */
  ariaLabel?: string;
  /**
   * Content rendered inside the scaled/translated container, in content-pixel
   * space. Mark backdrop layers with `data-pan-bg` so pointer events on them
   * are routed to the pan handler (overlay children without the attribute
   * still receive their own clicks/hover).
   */
  children: (view: PanZoomView) => ReactNode;
}

// Inlined to keep the package leaf — game-db's `clamp` would cross the boundary.
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

// User zoom bounds, relative to the fitted base scale.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
// Breathing room left around the content when fitting it to the viewport.
const FIT_PADDING = 24;

export function PanZoomCanvas({
  contentSize,
  placeholder,
  maxBaseScale = 1,
  scrollKey,
  className,
  ariaLabel,
  children,
}: PanZoomCanvasProps) {
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
  // drawn at `baseScale * zoom`. `baseScale` fits the content to the viewport on
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
  const contentSizeRef = useRef(contentSize);
  contentSizeRef.current = contentSize;
  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  // Keep the content anchored to the viewport: lock to centre on any axis where
  // it's smaller than the container, otherwise stop the edges from pulling
  // inside the frame. This both centres a fully-visible content (so it reads
  // as "fit to the container") and bounds dragging/zoom when it overflows.
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const content = contentSizeRef.current;
    const cont = containerSizeRef.current;
    if (!content || !cont) return { x, y };
    const contentW = content.w * scale;
    const contentH = content.h * scale;
    return {
      x: contentW <= cont.w ? (cont.w - contentW) / 2 : clamp(x, cont.w - contentW, 0),
      y: contentH <= cont.h ? (cont.h - contentH) / 2 : clamp(y, cont.h - contentH, 0),
    };
  }, []);

  // (Re)fit and centre whenever new content loads and the viewport is measured.
  // Re-keying on contentSize identity (not just truthiness) lets a swap to
  // a differently-sized content re-fit; same-reference renders don't.
  const initedFor = useRef<typeof contentSize | null>(null);
  useLayoutEffect(() => {
    if (!contentSize || !containerSize) return;
    if (initedFor.current === contentSize) return;
    initedFor.current = contentSize;
    const fitW = (containerSize.w - FIT_PADDING * 2) / contentSize.w;
    const fitH = (containerSize.h - FIT_PADDING * 2) / contentSize.h;
    // Never upscale past the consumer's cap; shrink large content to fit.
    // `Math.max(…, 0.01)` guards a zero-sized container before measure.
    const base = Math.max(0.01, Math.min(maxBaseScale, fitW, fitH));
    setBaseScale(base);
    setZoom(1);
    setPan({
      x: (containerSize.w - contentSize.w * base) / 2,
      y: (containerSize.h - contentSize.h * base) / 2,
    });
  }, [contentSize, containerSize, maxBaseScale]);
  useEffect(() => {
    if (!contentSize) initedFor.current = null;
  }, [contentSize]);

  // Zoom by `factor` while keeping the (clientX, clientY) point under the
  // cursor fixed. `baseScale` cancels out, so the maths is purely on `zoom`.
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
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
    },
    [clampPan],
  );

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
  // pinch-zoom around their midpoint. Pointers landing on an overlay child are
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
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
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
        setPan(
          clampPan(midX - (midX - p.x) * k, midY - (midY - p.y) * k, baseScaleRef.current * next),
        );
        setZoom(next);
        return;
      }
      if (drag.current) {
        const d = drag.current;
        const scale = baseScaleRef.current * zoomRef.current;
        setPan(
          clampPan(d.panX + (e.clientX - d.startX), d.panY + (e.clientY - d.startY), scale),
        );
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
    // Clamped, so a fully-visible content stays centred rather than panning
    // the highlight to the middle and exposing empty space.
    setPan((p) =>
      clampPan(p.x + (cRect.width / 2 - ecx), p.y + (cRect.height / 2 - ecy), scale),
    );
    // `baseScale` is included so a highlight present on first open re-centres
    // once the initial fit has run (it only changes on (re)fit, not on zoom).
  }, [scrollKey, baseScale, clampPan]);

  const effectiveScale = baseScale * zoom;
  const view = useMemo<PanZoomView | null>(
    () => (contentSize ? { contentSize, scale: effectiveScale } : null),
    [contentSize, effectiveScale],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted/30 relative flex-1 select-none overflow-hidden',
        contentSize && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        className,
      )}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      // We drive every gesture ourselves; opt out of the browser's own
      // pan/zoom so it doesn't fight the transform.
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!view ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-6 text-sm">
          {placeholder}
        </div>
      ) : (
        <div
          data-pan-bg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: view.contentSize.w,
            height: view.contentSize.h,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${effectiveScale})`,
            transformOrigin: 'top left',
          }}
        >
          {children(view)}
        </div>
      )}
    </div>
  );
}
