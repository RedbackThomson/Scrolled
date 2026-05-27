import type { PortalLayer } from '@/domain/portal-types';

/** WZ sentinel for "no target map" on return/forced-return/portal fields. */
export const NO_TARGET = 999999999;

/** Short label shown on the right of each portal row, per classified layer. */
export const PORTAL_LAYER_LABEL: Record<PortalLayer, string> = {
  spawn: 'Spawn',
  portal: 'Portal',
  internalTeleport: 'Teleport',
  unknown: 'Portal',
};
