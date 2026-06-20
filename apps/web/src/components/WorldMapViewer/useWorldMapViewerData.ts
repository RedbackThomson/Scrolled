import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient } from '@/db';

export function useWorldMapViewerData(worldMapId: string, enabled: boolean) {
  const client = useMemo(() => getDbClient(), []);
  const on = enabled && worldMapId.length > 0;

  const worldMapQ = useQuery({
    queryKey: ['db', 'world-map', worldMapId],
    queryFn: () => client.getWorldMap(worldMapId),
    staleTime: 5 * 60_000,
    enabled: on,
  });
  const markersQ = useQuery({
    queryKey: ['db', 'world-map', worldMapId, 'markers'],
    queryFn: () => client.getWorldMapMarkers(worldMapId),
    staleTime: 5 * 60_000,
    enabled: on,
  });
  const linksQ = useQuery({
    queryKey: ['db', 'world-map', worldMapId, 'links'],
    queryFn: () => client.getWorldMapLinks(worldMapId),
    staleTime: 5 * 60_000,
    enabled: on,
  });

  return {
    worldMap: worldMapQ.data ?? null,
    markers: markersQ.data ?? [],
    links: linksQ.data ?? [],
    isLoading: worldMapQ.isLoading || markersQ.isLoading || linksQ.isLoading,
  };
}
