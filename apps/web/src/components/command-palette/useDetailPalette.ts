import { useEffect } from 'react';
import { useRecentEntities } from '@/lib/recents';
import type { EntityKind } from '@/db';
import type { CommandItem } from './types';
import { usePaletteRegistration } from './usePaletteContext';

interface DetailPaletteInput {
  entity: EntityKind;
  id: number;
  name: string | null | undefined;
  items: CommandItem[];
}

/**
 * One-stop call for detail pages: registers the page with the palette
 * (so its context items render at the top) and feeds the "recently
 * viewed" list when the entity finishes loading.
 *
 * `items` must be memoized by the caller — the registration re-runs
 * on every identity change.
 */
export function useDetailPalette({ entity, id, name, items }: DetailPaletteInput) {
  const { track } = useRecentEntities();
  usePaletteRegistration({ entity, id, name: name ?? undefined, items });

  useEffect(() => {
    if (!name) return;
    if (!Number.isFinite(id)) return;
    track({ entity, id, name });
  }, [entity, id, name, track]);
}
