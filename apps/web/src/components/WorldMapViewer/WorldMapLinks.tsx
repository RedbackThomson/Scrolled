import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorldMapLinkRecord } from '@/db';

interface Props {
  links: WorldMapLinkRecord[];
  /** Object URLs for each link's overlay PNG, keyed by link id. */
  urls: Map<string, string>;
  baseOriginX: number;
  baseOriginY: number;
  /** Base image natural dimensions — the hit layer spans these. */
  width: number;
  height: number;
  onNavigate: (targetWorldMapId: string) => void;
}

// Treat pixels above this alpha as part of the clickable region.
const ALPHA_HIT = 16;

/**
 * Region link overlays with pixel-accurate hit testing. Link PNGs are mostly
 * transparent (a region-shaped highlight inside a larger canvas), and they
 * overlap, so a plain rectangular hover target fires over empty pixels and
 * lights up the wrong region. Instead we decode each image's alpha once and,
 * on pointer move over a single full-map hit layer, pick the top-most link
 * whose opaque pixels are actually under the cursor.
 */
export function WorldMapLinks({
  links,
  urls,
  baseOriginX,
  baseOriginY,
  width,
  height,
  onNavigate,
}: Props) {
  const [alpha, setAlpha] = useState<Map<string, ImageData>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const decoded = new Map<string, ImageData>();
    let remaining = 0;
    const settle = () => {
      if (!cancelled && remaining === 0) setAlpha(decoded);
    };
    for (const l of links) {
      const url = urls.get(l.id);
      if (!url) continue;
      remaining += 1;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            decoded.set(l.id, ctx.getImageData(0, 0, c.width, c.height));
          } catch {
            // Tainted canvas shouldn't happen for same-origin blobs; skip.
          }
        }
        remaining -= 1;
        settle();
      };
      img.onerror = () => {
        remaining -= 1;
        settle();
      };
      img.src = url;
    }
    setHoveredId(null);
    setCursor(null);
    if (remaining === 0) setAlpha(new Map());
    return () => {
      cancelled = true;
    };
  }, [links, urls]);

  // Top-most (highest z / latest) link whose opaque pixel is under (px, py),
  // expressed in image-pixel space.
  const linkAt = (px: number, py: number): WorldMapLinkRecord | null => {
    for (let i = links.length - 1; i >= 0; i--) {
      const l = links[i]!;
      const data = alpha.get(l.id);
      if (!data) continue;
      const lx = Math.floor(px - (baseOriginX - l.originX));
      const ly = Math.floor(py - (baseOriginY - l.originY));
      if (lx < 0 || ly < 0 || lx >= data.width || ly >= data.height) continue;
      const a = data.data[(ly * data.width + lx) * 4 + 3] ?? 0;
      if (a > ALPHA_HIT) return l;
    }
    return null;
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const hit = linkAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setHoveredId(hit?.id ?? null);
    setCursor(hit ? { x: e.clientX, y: e.clientY } : null);
  };

  const hovered = hoveredId ? (links.find((l) => l.id === hoveredId) ?? null) : null;

  return (
    <>
      {links.map((l) => {
        const url = urls.get(l.id);
        if (!url) return null;
        return (
          <img
            key={l.id}
            src={url}
            alt=""
            style={{
              position: 'absolute',
              left: baseOriginX - l.originX,
              top: baseOriginY - l.originY,
              display: 'block',
              imageRendering: 'pixelated',
              pointerEvents: 'none',
              zIndex: 1,
              opacity: hoveredId === l.id ? 1 : 0,
              transition: 'opacity 150ms',
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          zIndex: 2,
          cursor: hovered ? 'pointer' : 'default',
        }}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHoveredId(null);
          setCursor(null);
        }}
        onClick={() => {
          if (hovered) onNavigate(hovered.targetWorldMapId);
        }}
      />
      {hovered?.tooltip &&
        cursor &&
        createPortal(
          <div
            style={{ position: 'fixed', left: cursor.x + 12, top: cursor.y + 12, zIndex: 60 }}
            className="border-border bg-card text-foreground pointer-events-none rounded-md border px-2 py-1 text-xs shadow-md"
          >
            {hovered.tooltip}
          </div>,
          document.body,
        )}
    </>
  );
}
