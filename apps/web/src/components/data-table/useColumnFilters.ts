// Dynamic per-column filter URL state.
//
// Each filterable column gets its own URL keys:
//   - string columns: `f_<col>=foo`, optional `f_<col>_mode=prefix|suffix|equals`
//                     (`contains` is the default and clears from the URL)
//                                                → { kind: 'string', mode, value }
//   - enum columns:   `f_<col>=Fire,Ice` (comma-joined; server treats as IN)
//                                                → { kind: 'enum', values }
//   - number columns: `f_<col>_min=10`, `f_<col>_max=50`
//                                                → { kind: 'range', min, max }
//
// The hook builds a nuqs `useQueryStates` parser map at first render from the
// column defs' `meta.filter` so the URL keys derive automatically from the
// table's schema — no per-route boilerplate.

import { useCallback, useMemo } from 'react';
import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
  type ParserBuilder,
  type UseQueryStatesKeysMap,
} from 'nuqs';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnFilter, StringFilterMode } from '@/db';
import type { FilterType } from './types';

const STRING_MODES = ['contains', 'prefix', 'suffix', 'equals'] as const;
const DEFAULT_STRING_MODE: StringFilterMode = 'contains';

export interface ColumnFilterableSpec {
  id: string;
  type: FilterType;
}

export interface UseColumnFiltersResult {
  /** Public column id → filter value, keyed for sending to the DB API. */
  filters: Record<string, ColumnFilter>;
  /** True when at least one column has an active filter value. */
  active: boolean;
  /** Set or clear a single column's filter. Passing `null` clears the column. */
  setFilter: (columnId: string, value: ColumnFilter | null) => void;
  /** Clear every column filter at once. */
  clearAll: () => void;
  /** Convenience: per-column lookup the popover uses to seed its inputs. */
  getFilter: (columnId: string) => ColumnFilter | undefined;
}

function collectFilterable<TData>(columns: readonly ColumnDef<TData>[]): ColumnFilterableSpec[] {
  const out: ColumnFilterableSpec[] = [];
  for (const col of columns) {
    const id = col.id;
    const ftype = col.meta?.filter;
    if (id && ftype) out.push({ id, type: ftype });
  }
  return out;
}

/**
 * Build the `useQueryStates` parser map from the filterable column list.
 * Numbers use parseAsFloat so REAL columns (e.g. `mob_rate`) round-trip.
 * All keys clear on default so an empty filter doesn't pollute the URL.
 */
const BOOLEAN_VALUES = ['1', '0'] as const;

function buildParsers(
  filterable: ColumnFilterableSpec[],
): Record<
  string,
  | ParserBuilder<string>
  | ParserBuilder<string[]>
  | ParserBuilder<number>
  | ParserBuilder<StringFilterMode>
  | ParserBuilder<(typeof BOOLEAN_VALUES)[number]>
> {
  const map: Record<
    string,
    | ParserBuilder<string>
    | ParserBuilder<string[]>
    | ParserBuilder<number>
    | ParserBuilder<StringFilterMode>
    | ParserBuilder<(typeof BOOLEAN_VALUES)[number]>
  > = {};
  for (const { id, type } of filterable) {
    if (type === 'string') {
      map[`f_${id}`] = parseAsString
        .withDefault('')
        .withOptions({ throttleMs: 300, clearOnDefault: true });
      map[`f_${id}_mode`] = parseAsStringLiteral(STRING_MODES)
        .withDefault(DEFAULT_STRING_MODE)
        .withOptions({ clearOnDefault: true });
    } else if (type === 'enum') {
      // Enum is comma-joined: `f_weakAgainst=Fire,Ice` round-trips as
      // ['Fire', 'Ice']. Single-value URLs from older saved searches
      // come through as a one-element array.
      map[`f_${id}`] = parseAsArrayOf(parseAsString, ',').withOptions({ clearOnDefault: true });
    } else if (type === 'boolean') {
      // Boolean filters are tristate (any / true / false) and surface as
      // a range filter with min=max=1 or 0, so the server's number-column
      // path turns them into `col = ?` without new branches.
      map[`f_${id}`] = parseAsStringLiteral(BOOLEAN_VALUES).withOptions({
        clearOnDefault: true,
      });
    } else {
      // parseAsFloat has no default — absent means "no bound". The
      // discriminated-union return on the hook treats null as omitted.
      map[`f_${id}_min`] = parseAsFloat.withOptions({ clearOnDefault: true });
      map[`f_${id}_max`] = parseAsFloat.withOptions({ clearOnDefault: true });
    }
  }
  return map;
}

export function useColumnFilters<TData>(
  columns: readonly ColumnDef<TData>[],
): UseColumnFiltersResult {
  const filterable = useMemo(() => collectFilterable(columns), [columns]);
  const parsers = useMemo(() => buildParsers(filterable), [filterable]);

  const [state, setState] = useQueryStates(
    // The cast is safe: parsers are typed per-id and useQueryStates returns
    // a record matching the parser map.
    parsers as unknown as UseQueryStatesKeysMap,
    { history: 'replace' },
  );

  const filters = useMemo(() => {
    const out: Record<string, ColumnFilter> = {};
    for (const { id, type } of filterable) {
      if (type === 'string') {
        const v = (state[`f_${id}`] as string | null | undefined) ?? '';
        const m =
          (state[`f_${id}_mode`] as StringFilterMode | null | undefined) ?? DEFAULT_STRING_MODE;
        // Surface an entry whenever EITHER the value is non-empty OR the
        // user has explicitly picked a non-default mode (so the popover's
        // mode selector reflects the URL even before typing).
        if (v.length > 0 || m !== DEFAULT_STRING_MODE) {
          out[id] = { kind: 'string', mode: m, value: v };
        }
      } else if (type === 'enum') {
        const v = state[`f_${id}`] as string[] | null | undefined;
        if (v && v.length > 0) {
          out[id] = { kind: 'enum', values: v };
        }
      } else if (type === 'boolean') {
        const v = state[`f_${id}`] as '1' | '0' | null | undefined;
        if (v === '1' || v === '0') {
          const n = v === '1' ? 1 : 0;
          out[id] = { kind: 'range', min: n, max: n };
        }
      } else {
        const min = state[`f_${id}_min`] as number | null | undefined;
        const max = state[`f_${id}_max`] as number | null | undefined;
        if ((min !== null && min !== undefined) || (max !== null && max !== undefined)) {
          out[id] = {
            kind: 'range',
            min: min ?? undefined,
            max: max ?? undefined,
          };
        }
      }
    }
    return out;
  }, [filterable, state]);

  // `active` counts only filters with real effect — an empty value with a
  // non-default mode picked is "remembered" but not narrowing.
  const active = useMemo(
    () =>
      Object.values(filters).some((f) =>
        f.kind === 'string'
          ? f.value.length > 0
          : f.kind === 'enum'
            ? f.values.length > 0
            : f.min !== undefined || f.max !== undefined,
      ),
    [filters],
  );

  const setFilter = useCallback(
    (columnId: string, value: ColumnFilter | null) => {
      const spec = filterable.find((s) => s.id === columnId);
      if (!spec) return;
      if (spec.type === 'string') {
        const isStringPatch = value !== null && value.kind === 'string';
        const nextValue = isStringPatch ? value.value : '';
        // Mode persists even when the value is empty so the picker remembers
        // the user's choice between keystrokes. Passing `null` clears both.
        const nextMode =
          value === null ? DEFAULT_STRING_MODE : isStringPatch ? value.mode : DEFAULT_STRING_MODE;
        void setState({
          [`f_${columnId}`]: nextValue,
          [`f_${columnId}_mode`]: nextMode,
        });
      } else if (spec.type === 'enum') {
        // null clears; an `enum` patch writes the value list (a one-element
        // array round-trips to the same single-value URL old saved searches
        // produced).
        const next =
          value !== null && value.kind === 'enum' && value.values.length > 0 ? value.values : null;
        void setState({ [`f_${columnId}`]: next });
      } else if (spec.type === 'boolean') {
        const n = value && value.kind === 'range' ? (value.min ?? value.max) : null;
        const next = n === 1 ? '1' : n === 0 ? '0' : null;
        void setState({ [`f_${columnId}`]: next });
      } else {
        const min = value && value.kind === 'range' ? (value.min ?? null) : null;
        const max = value && value.kind === 'range' ? (value.max ?? null) : null;
        void setState({
          [`f_${columnId}_min`]: min,
          [`f_${columnId}_max`]: max,
        });
      }
    },
    [filterable, setState],
  );

  const clearAll = useCallback(() => {
    const patch: Record<string, string | string[] | number | null | StringFilterMode> = {};
    for (const { id, type } of filterable) {
      if (type === 'string') {
        patch[`f_${id}`] = '';
        patch[`f_${id}_mode`] = DEFAULT_STRING_MODE;
      } else if (type === 'enum') {
        patch[`f_${id}`] = null;
      } else if (type === 'boolean') {
        patch[`f_${id}`] = null;
      } else {
        patch[`f_${id}_min`] = null;
        patch[`f_${id}_max`] = null;
      }
    }
    void setState(patch);
  }, [filterable, setState]);

  const getFilter = useCallback((columnId: string) => filters[columnId], [filters]);

  return {
    filters,
    active,
    setFilter,
    clearAll,
    getFilter,
  };
}
