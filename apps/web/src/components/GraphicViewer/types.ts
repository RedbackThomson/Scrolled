import type { LucideIcon } from 'lucide-react';

/** A toggleable overlay layer shown in the bottom control bar. */
export interface LayerDescriptor {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Tailwind text-color class for the swatch glyph. */
  swatch: string;
  count: number;
}

/** Per-layer on/off state, keyed by `LayerDescriptor.key`. */
export type LayerVisibility = Record<string, boolean>;

/** Geometry the canvas exposes to overlay render-props so consumers can
 *  project their own coordinates into image-pixel space. */
export interface GraphicViewerView {
  /** Natural (intrinsic) image pixel dimensions. */
  imageSize: { w: number; h: number };
  /** Effective render scale = integer fit scale × user pinch zoom. Pass as
   *  `parentScale` to `GraphicViewerIcon` so pins stay a constant CSS size. */
  scale: number;
}
