// The hosted dataset installed on this build, or null on the generic site
// (and before the first install). Shares the `['db', 'installed-dataset']`
// query key with useDatasetUpdate, so mounting both costs one fetch.

import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/config';
import { getDbClient } from '@/db';

export function useInstalledDataset() {
  const fixed = appConfig.fixedDataset;
  const q = useQuery({
    queryKey: ['db', 'installed-dataset'],
    queryFn: () => getDbClient().getInstalledDataset(),
    enabled: !!fixed,
  });
  return q.data ?? null;
}
