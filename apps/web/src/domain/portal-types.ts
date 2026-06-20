// Helpers for interpreting WZ portal data and projecting game coords onto
// the minimap. Used by the map viewer to bucket portals into spawn / portal /
// internal-teleport layers and to position icon overlays.

import type { MapPortalRecord } from '@/db';

export const PORTAL_TYPE = {
  SPAWN: 0,
  INVISIBLE: 1,
  REGULAR: 2,
  CLOSED: 3,
  HIDDEN: 4,
  SCRIPTED_HIDDEN: 5,
  SCRIPTED: 6,
  TOWN: 7,
  SCRIPT_INVISIBLE: 8,
} as const;

export type PortalLayer = 'spawn' | 'portal' | 'internalTeleport' | 'unknown';

// Sentinel target used by maps that have no follow-up location (e.g. one-off
// scripted warps that resolve at runtime).
const NO_TARGET = 999999999;

export function classifyPortal(p: MapPortalRecord, thisMapId: number): PortalLayer {
  if (p.portalType === PORTAL_TYPE.SPAWN) return 'spawn';
  const targetsExternal =
    p.targetMapId !== null && p.targetMapId !== NO_TARGET && p.targetMapId !== thisMapId;
  if (targetsExternal) return 'portal';
  if (p.script || p.targetMapId === thisMapId || p.targetMapId === NO_TARGET) {
    return 'internalTeleport';
  }
  return 'unknown';
}

// GM teleport portals (`gm`, `gm0`, `gm1`, …) exist for staff, not players.
const GM_PORTAL_NAME = /^gm\d*$/i;

/**
 * Whether a portal is one a visitor can actually travel through — an inter-map
 * doorway or a working in-map teleport. Excludes spawn points, GM-only portals,
 * and dead-end portals (e.g. unused `tp` entries) that resolve to no real
 * destination. Drives the "hide minor portals" toggle on the map detail page.
 */
export function isUsefulPortal(p: MapPortalRecord, thisMapId: number): boolean {
  if (GM_PORTAL_NAME.test(p.portalName)) return false;
  const layer = classifyPortal(p, thisMapId);
  if (layer === 'portal') return true;
  if (layer === 'internalTeleport') {
    // Useful only if it lands somewhere in this map or runs a script. The
    // NO_TARGET placeholder (a `tp` portal with no destination) does neither.
    return p.targetMapId === thisMapId || Boolean(p.script);
  }
  // spawn + unknown: not navigable.
  return false;
}

export function gameToPixel(
  gameX: number,
  gameY: number,
  centerX: number,
  centerY: number,
  mag: number,
): { x: number; y: number } {
  return { x: (gameX + centerX) / mag, y: (gameY + centerY) / mag };
}

/**
 * Same-map teleport graph derived from portal records.
 *
 * - `forwardNames` maps a source portal's idx to the list of `pn` values it
 *   links to (the `tn` of that portal, when resolvable to portals in the
 *   same map). Used by the sidebar to render arrows like "Same map -> foo".
 * - `componentOf` maps a portal idx to the *undirected* connected component
 *   (as a Set of idx values) it belongs to. A pair like `A.tn=B / B.tn=A`,
 *   a 3-cycle `A->B->C->A`, and a one-way `A->B` all yield the same set
 *   `{A, B [, C]}`, which the canvas uses to highlight every portal that
 *   belongs to the same teleport chain when one is selected or hovered.
 */
export interface PortalGraph {
  forwardNames: Map<number, string[]>;
  componentOf: Map<number, ReadonlySet<number>>;
}

export function buildPortalGraph(
  portals: readonly MapPortalRecord[],
  currentMapId: number,
): PortalGraph {
  const byName = new Map<string, number[]>();
  for (const p of portals) {
    const list = byName.get(p.portalName);
    if (list) list.push(p.idx);
    else byName.set(p.portalName, [p.idx]);
  }

  const forwardNames = new Map<number, string[]>();
  // Union-find — initialise every portal as its own root.
  const parent = new Map<number, number>();
  for (const p of portals) parent.set(p.idx, p.idx);
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as number;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur) as number;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const p of portals) {
    const tm = p.targetMapId;
    const tn = p.targetPortal;
    if (!tn) continue;
    // Same-map links are the only ones we connect. We treat tm === currentMapId
    // as definitive; NO_TARGET / null aren't unioned because their tn isn't
    // a reliable reference into this map's portals.
    if (tm !== currentMapId) continue;
    const targets = byName.get(tn);
    if (!targets || targets.length === 0) continue;
    forwardNames.set(p.idx, [tn]);
    for (const tgtIdx of targets) {
      if (tgtIdx !== p.idx) union(p.idx, tgtIdx);
    }
  }

  // Build the component sets keyed by root.
  const groups = new Map<number, Set<number>>();
  for (const p of portals) {
    const root = find(p.idx);
    let g = groups.get(root);
    if (!g) {
      g = new Set();
      groups.set(root, g);
    }
    g.add(p.idx);
  }
  const componentOf = new Map<number, ReadonlySet<number>>();
  for (const p of portals) {
    componentOf.set(p.idx, groups.get(find(p.idx)) as ReadonlySet<number>);
  }

  return { forwardNames, componentOf };
}
