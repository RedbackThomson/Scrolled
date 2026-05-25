import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient } from '@/db';

// Shares query keys with `MapDetail` so opening the modal doesn't re-fetch
// anything that's already cached. Only `mob-spawns` is new.
export function useMapViewerData(mapId: number, enabled: boolean) {
  const client = useMemo(() => getDbClient(), []);

  const mapQ = useQuery({
    queryKey: ['db', 'map', mapId],
    queryFn: () => client.getMap(mapId),
    staleTime: 5 * 60_000,
    enabled: enabled && Number.isFinite(mapId),
  });
  const npcsQ = useQuery({
    queryKey: ['db', 'map', mapId, 'npcs'],
    queryFn: () => client.getMapNpcs(mapId),
    staleTime: 5 * 60_000,
    enabled: enabled && Number.isFinite(mapId),
  });
  const portalsQ = useQuery({
    queryKey: ['db', 'map', mapId, 'portals'],
    queryFn: () => client.getMapPortals(mapId),
    staleTime: 5 * 60_000,
    enabled: enabled && Number.isFinite(mapId),
  });
  const mobSpawnsQ = useQuery({
    queryKey: ['db', 'map', mapId, 'mob-spawns'],
    queryFn: () => client.getMapMobSpawns(mapId),
    staleTime: 5 * 60_000,
    enabled: enabled && Number.isFinite(mapId),
  });

  return {
    map: mapQ.data ?? null,
    npcs: npcsQ.data ?? [],
    portals: portalsQ.data ?? [],
    mobSpawns: mobSpawnsQ.data ?? [],
    isLoading: mapQ.isLoading || npcsQ.isLoading || portalsQ.isLoading || mobSpawnsQ.isLoading,
  };
}
