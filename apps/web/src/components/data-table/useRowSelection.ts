import { useCallback, useEffect, useRef, useState } from 'react';

export interface RowSelection {
  /** Explicitly chosen row ids; ignored while `allMatching` */
  ids: ReadonlySet<string>;
  /** Every row matching the filters, resolved when it's used rather than held as ids */
  allMatching: boolean;
  isSelected: (id: string) => boolean;
  /** `pageIds` is the visible page in order, for shift-click ranges within it */
  toggle: (id: string, range: boolean, pageIds: readonly string[]) => void;
  selectAllMatching: () => void;
  clear: () => void;
}

/**
 * Row selection that survives paging and sorting, so rows can be picked across
 * pages, and resets whenever `resetKey` (the filters) changes, since the rows
 * it named may no longer match. `resolveAll` lists every matching id; toggling a
 * row off from "select all" needs it to fall back to an explicit set.
 */
export function useRowSelection(
  resetKey: string,
  resolveAll: () => Promise<string[]>,
): RowSelection {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const lastToggled = useRef<string | null>(null);

  useEffect(() => {
    setIds(new Set());
    setAllMatching(false);
    lastToggled.current = null;
  }, [resetKey]);

  const toggle = useCallback(
    (id: string, range: boolean, pageIds: readonly string[]) => {
      if (allMatching) {
        setAllMatching(false);
        void resolveAll().then((all) => setIds(new Set(all.filter((x) => x !== id))));
        lastToggled.current = id;
        return;
      }
      const from = lastToggled.current == null ? -1 : pageIds.indexOf(lastToggled.current);
      const to = pageIds.indexOf(id);
      const span =
        range && from >= 0 && to >= 0
          ? pageIds.slice(Math.min(from, to), Math.max(from, to) + 1)
          : [id];
      setIds((prev) => {
        const next = new Set(prev);
        const on = !prev.has(id);
        for (const x of span) {
          if (on) next.add(x);
          else next.delete(x);
        }
        return next;
      });
      lastToggled.current = id;
    },
    [allMatching, resolveAll],
  );

  return {
    ids,
    allMatching,
    isSelected: (id) => allMatching || ids.has(id),
    toggle,
    selectAllMatching: () => setAllMatching(true),
    clear: () => {
      setIds(new Set());
      setAllMatching(false);
      lastToggled.current = null;
    },
  };
}
