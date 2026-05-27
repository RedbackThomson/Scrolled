import type { MapViewerHighlight } from './types';

// URL serialisation for the `viewer` search param:
//   absent     → modal closed
//   "1"        → modal open, no highlight
//   "npc:1234" → modal open, NPC 1234 highlighted (likewise mob:, portal:)
// Splits on the first `:` so portal names containing colons round-trip.
export function parseViewerParam(value: string | null): {
  open: boolean;
  highlight: MapViewerHighlight | null;
} {
  if (!value) return { open: false, highlight: null };
  if (value === '1') return { open: true, highlight: null };
  const idx = value.indexOf(':');
  if (idx < 0) return { open: true, highlight: null };
  const kind = value.slice(0, idx);
  const key = value.slice(idx + 1);
  if (!key) return { open: true, highlight: null };
  if (kind === 'npc' || kind === 'mob' || kind === 'portal') {
    return { open: true, highlight: { kind, key } };
  }
  return { open: true, highlight: null };
}

export function serializeViewerParam(
  open: boolean,
  highlight: MapViewerHighlight | null,
): string | null {
  if (!open) return null;
  if (!highlight) return '1';
  return `${highlight.kind}:${highlight.key}`;
}
