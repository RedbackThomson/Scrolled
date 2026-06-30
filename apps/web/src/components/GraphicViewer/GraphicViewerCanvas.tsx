import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clamp } from '@scrolled/game-db/lib/math';
import { PanZoomCanvas, type PanZoomView } from '@scrolled/ui';
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

  // Crisp pixel-art upscale cap. PanZoomCanvas defaults to 1 (no upscale),
  // which is wrong for tiny minimap PNGs.
  const maxBaseScale = useMemo(
    () => (imgSize ? pickScale(imgSize.w, imgSize.h) : 1),
    [imgSize],
  );

  return (
    <PanZoomCanvas
      contentSize={imgSize}
      placeholder={!blobUrl ? unavailableMessage : loadingMessage}
      maxBaseScale={maxBaseScale}
      scrollKey={scrollKey}
      ariaLabel={ariaLabel}
    >
      {(view: PanZoomView) => (
        <>
          {blobUrl && (
            <img
              data-pan-bg
              src={blobUrl}
              width={view.contentSize.w}
              height={view.contentSize.h}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
          )}
          {children({ imageSize: view.contentSize, scale: view.scale })}
        </>
      )}
    </PanZoomCanvas>
  );
}
