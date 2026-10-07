import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import {
  columns,
  defaultSort,
  defaultVisible,
  mobileCard,
  pinnedColumns,
  facets,
} from './MapsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Maps() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);

  const mapsQ = useQuery({
    queryKey: [
      'db',
      'maps',
      { sort: state.sort, dir: state.dir, page: state.page, size: state.size, filters },
    ],
    queryFn: () =>
      client.listMaps({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = mapsQ.data?.total === 0 && !filtersActive;

  return (
    <TablePageLayout title="Maps" entityPlural="maps" isEmpty={isEmpty}>
      <DataTable
        source="map"
        facets={facets}
        entityPlural="maps"
        data={mapsQ.data?.rows ?? []}
        total={mapsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(m) => `/maps/${m.id}`}
        getRowId={(m) => String(m.id)}
        mobileCard={mobileCard}
        emptyMessage="No maps found."
        loading={mapsQ.isLoading}
        fetching={mapsQ.isFetching && !mapsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="map"
      />
    </TablePageLayout>
  );
}
