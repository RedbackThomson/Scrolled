import { useMemo } from 'react';
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

const SORT_DIR = ['asc', 'desc'] as const;
export type TableSortDir = (typeof SORT_DIR)[number];

export interface TableUrlStateOptions {
  defaultSort: { id: string; dir: TableSortDir };
  defaultSize: number;
  defaultVisible: readonly string[];
}

export interface TableUrlState {
  q: string;
  page: number;
  size: number;
  sort: string;
  dir: TableSortDir;
}

export interface TableUrlStatePatch {
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
  dir?: TableSortDir;
  cols?: string[] | null;
}

/**
 * Consolidates the table's URL-persisted state into one `useQueryStates`
 * call so all writes batch into a single `history.replaceState`.
 *
 * `cols === null` means "use the entity's defaultVisible"; we never persist
 * a `cols=` param while the user's selection matches the defaults, which
 * keeps default URLs short.
 */
export function useTableUrlState(opts: TableUrlStateOptions) {
  const { defaultSort, defaultSize, defaultVisible } = opts;
  const defaultVisibleKey = useMemo(
    () => [...defaultVisible].sort().join(','),
    [defaultVisible],
  );

  const [state, setStateRaw] = useQueryStates(
    {
      q: parseAsString.withDefault('').withOptions({ throttleMs: 300, clearOnDefault: true }),
      page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
      size: parseAsInteger.withDefault(defaultSize).withOptions({ clearOnDefault: true }),
      sort: parseAsString.withDefault(defaultSort.id).withOptions({ clearOnDefault: true }),
      dir: parseAsStringLiteral(SORT_DIR)
        .withDefault(defaultSort.dir)
        .withOptions({ clearOnDefault: true }),
      cols: parseAsArrayOf(parseAsString, ',').withOptions({ clearOnDefault: true }),
    },
    { history: 'replace' },
  );

  const setState = (patch: TableUrlStatePatch) => {
    void setStateRaw(patch);
  };

  // `cols === null` -> fall back to entity defaults.
  const visibleColumns = state.cols ?? [...defaultVisible];

  return {
    state: {
      q: state.q,
      page: state.page,
      size: state.size,
      sort: state.sort,
      dir: state.dir,
    } satisfies TableUrlState,
    setState,
    visibleColumns,
    defaultVisibleKey,
  };
}
