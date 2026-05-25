import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { TablePageLayout } from '@/components/TablePageLayout';
import { getDbClient } from '@/db';
import {
  columns,
  defaultSort,
  defaultVisible,
  ELEMENT_ENUM_OPTIONS,
  pinnedColumns,
} from './MobsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Mobs() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const mobsQ = useQuery({
    queryKey: [
      'db',
      'mobs',
      {
        q: state.q,
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listMobs({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = mobsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <TablePageLayout title="Mobs" entityPlural="mobs" isEmpty={isEmpty}>
      <DataTable
        data={mobsQ.data?.rows ?? []}
        total={mobsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(m) => `/mobs/${m.id}`}
        getRowId={(m) => String(m.id)}
        emptyMessage="No mobs found."
        loading={mobsQ.isLoading}
        fetching={mobsQ.isFetching && !mobsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        enumOptions={{
          weakAgainst: ELEMENT_ENUM_OPTIONS,
          strongAgainst: ELEMENT_ENUM_OPTIONS,
          immuneTo: ELEMENT_ENUM_OPTIONS,
        }}
        searchValue={state.q}
        onSearchChange={(v) => setState({ q: v, page: 1 })}
        searchPlaceholder="Search mobs by name"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 && (
            <CollectionsBulkAddMenu
              entityType="mob"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          )
        }
      />
    </TablePageLayout>
  );
}
