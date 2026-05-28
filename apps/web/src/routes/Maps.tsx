import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './MapsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Maps() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const mapsQ = useQuery({
    queryKey: [
      'db',
      'maps',
      { q: state.q, sort: state.sort, dir: state.dir, page: state.page, size: state.size, filters },
    ],
    queryFn: () =>
      client.listMaps({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = mapsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <TablePageLayout title="Maps" entityPlural="maps" isEmpty={isEmpty}>
      <DataTable
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
        emptyMessage="No maps found."
        loading={mapsQ.isLoading}
        fetching={mapsQ.isFetching && !mapsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        searchValue={state.q}
        onSearchChange={(v) => setState({ q: v, page: 1 })}
        searchPlaceholder="Search maps by name or street"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="map"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={
          <PinnedSearchesMenu
            entity="map"
            filtersActive={filtersActive || !!state.q.trim()}
          />
        }
      />
    </TablePageLayout>
  );
}
