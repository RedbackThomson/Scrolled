import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient, type JobRecord } from '@/db';

/**
 * Format a job-id reference for display. Pairs the numeric id with the
 * resolved name when one is available — falls back to "Job N" so a
 * partial extraction still shows something readable.
 */
export function formatJobRef(jobId: number, name: string | undefined): string {
  if (name) return `${jobId} · ${name}`;
  return `Job ${jobId}`;
}

/**
 * Fetch the whole `jobs` table and return an `id → name` lookup map.
 * The table is small (≤ ~50 rows) and changes only on re-extraction, so
 * we cache it with an infinite stale time — invalidation happens through
 * the standard `['db']` invalidation that follows an extract run.
 */
export function useJobsMap(): Map<number, string> {
  const client = useMemo(() => getDbClient(), []);
  const { data } = useQuery({
    queryKey: ['db', 'jobs'],
    queryFn: () => client.listJobs(),
    staleTime: Infinity,
  });
  return useMemo(() => {
    const m = new Map<number, string>();
    for (const j of (data as JobRecord[] | undefined) ?? []) m.set(j.id, j.name);
    return m;
  }, [data]);
}
