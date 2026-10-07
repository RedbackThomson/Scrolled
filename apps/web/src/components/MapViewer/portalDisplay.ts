import type { PortalLayer } from '@scrolled/game-db/domain/portal-types';

/** WZ sentinel for "no target map" on return/forced-return/portal fields. */
export const NO_TARGET = 999999999;

/** Short label shown on the right of each portal row, per classified layer. */
export const PORTAL_LAYER_LABEL: Record<PortalLayer, string> = {
  spawn: 'Spawn',
  portal: 'Portal',
  internalTeleport: 'Teleport',
  unknown: 'Portal',
};

/** Marker colours, as text-colour classes (markers fill with currentColor). */
export const MARKER_COLOR = {
  spawn: 'text-[oklch(0.62_0.16_150)]',
  portal: 'text-[oklch(0.62_0.16_235)]',
  teleport: 'text-[oklch(0.62_0.16_295)]',
  npc: 'text-[oklch(0.66_0.16_75)]',
  mob: 'text-[oklch(0.62_0.18_15)]',
  unknown: 'text-[oklch(0.62_0.02_250)]',
} as const;

/** Matching hues for tiles tinted with the same colour family. */
export const MARKER_HUE = {
  spawn: 150,
  portal: 235,
  teleport: 295,
  npc: 75,
  mob: 15,
} as const;
