// React adapter for the `ui_prefs` key-value table in the user DB.
//
// One key, one consumer. The value is opaque JSON to the worker; this
// hook handles serialize / parse and validates against a zod schema so
// a corrupted row resolves to the default rather than crashing.
//
// Reads are cached forever (`staleTime: Infinity`) because the worker
// is the only writer and we invalidate on every successful set.

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { ZodTypeAny, z } from 'zod';
import { getUserDbClient } from '@/db/user';

const ROOT_KEY = ['user', 'ui-prefs'] as const;

export function uiPrefKey(key: string) {
  return [...ROOT_KEY, key] as const;
}

export interface UseUiPrefResult<T> {
  /** Parsed value, or the default if the row is missing or invalid. */
  value: T;
  /** Persist a new value. Returns once the worker has confirmed the write. */
  set: (next: T) => Promise<void>;
  /** Reset to the default by deleting the row. */
  reset: () => Promise<void>;
  query: UseQueryResult<T>;
}

/**
 * Bind a single ui_prefs row to React state. `schema` runs against the
 * parsed JSON; failure falls back to `defaultValue` rather than throwing.
 */
export function useUiPref<S extends ZodTypeAny>(
  key: string,
  schema: S,
  defaultValue: z.infer<S>,
): UseUiPrefResult<z.infer<S>> {
  const db = useMemo(() => getUserDbClient(), []);
  const qc = useQueryClient();

  const query = useQuery<z.infer<S>>({
    queryKey: uiPrefKey(key),
    queryFn: async () => {
      const row = await db.getUiPref(key);
      if (!row) return defaultValue;
      try {
        const parsed = schema.safeParse(JSON.parse(row.value));
        return parsed.success ? parsed.data : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    staleTime: Infinity,
  });

  const setM = useMutation({
    mutationFn: async (next: z.infer<S>) => {
      await db.setUiPref(key, JSON.stringify(next));
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(uiPrefKey(key), next);
    },
  });

  const set = useCallback(
    async (next: z.infer<S>) => {
      await setM.mutateAsync(next);
    },
    [setM],
  );

  const reset = useCallback(async () => {
    await db.deleteUiPref(key);
    qc.setQueryData(uiPrefKey(key), defaultValue);
  }, [db, key, qc, defaultValue]);

  return {
    value: query.data ?? defaultValue,
    set,
    reset,
    query,
  };
}
