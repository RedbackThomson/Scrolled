import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clamp } from '@/lib/math';
import { bytesToUrl } from '@/lib/blob';
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
  /** Re-runs scroll-into-view of the highlighted overlay when this changes. */
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

  const scrollRef = useRef<HTMLDivElement>(null);

  // Touch pinch-zoom state. Native overflow scroll handles one-finger pan;
  // when a second finger touches down we intercept and drive a userZoom
  // multiplier. Origin stays top-left so scroll bounds line up.
  const [userZoom, setUserZoom] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStart.current = { distance, zoom: userZoom };
      }
    },
    [userZoom],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size !== 2 || !pinchStart.current) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart.current.distance === 0) return;
    const ratio = distance / pinchStart.current.distance;
    setUserZoom(clamp(pinchStart.current.zoom * ratio, 0.5, 4));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }, []);

  // Scroll the highlighted overlay into the centre of the scroll container
  // when `scrollKey` changes.
  useLayoutEffect(() => {
    if (scrollKey == null) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('[data-highlighted="true"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [scrollKey]);

  if (!blobUrl) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        {unavailableMessage}
      </div>
    );
  }
  if (!imgSize) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        {loadingMessage}
      </div>
    );
  }

  const width = imgSize.w;
  const height = imgSize.h;
  const scale = pickScale(width, height);
  const effectiveScale = scale * userZoom;

  return (
    <div
      ref={scrollRef}
      className="bg-muted/30 relative flex-1 overflow-auto"
      role="img"
      aria-label={ariaLabel}
      // `pan-x pan-y` lets the browser handle one-finger pan via native
      // overflow scroll; two-finger gestures fall through to our pointer
      // handlers which drive the pinch-zoom.
      style={{ touchAction: 'pan-x pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* `grid place-content-center` keeps the image centred when smaller than
          the viewport, while still letting the track grow past `min-h/w-full`
          (triggering scroll) for larger images. */}
      <div className="grid min-h-full min-w-full place-content-center p-6">
        <div style={{ width: width * effectiveScale, height: height * effectiveScale }} className="relative">
          <div
            style={{
              width,
              height,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              position: 'relative',
            }}
          >
            <img
              src={blobUrl}
              width={width}
              height={height}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
            {children({ imageSize: { w: width, h: height }, scale: effectiveScale })}
          </div>
        </div>
      </div>
    </div>
  );
}
