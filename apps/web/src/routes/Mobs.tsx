import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import { ELEMENT_ORDER } from '@/domain/mobElements';
import { columns, defaultSort, defaultVisible, mobileCard, pinnedColumns } from './MobsColumns';

const ELEMENT_ENUM_OPTIONS: readonly string[] = ELEMENT_ORDER;

const DEFAULT_PAGE_SIZE = 50;

export default function Mobs() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const mobsQ = useQuery({
    queryKey: [
      'db',
      'mobs',
      {
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listMobs({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = mobsQ.data?.total === 0 && !filtersActive;

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
        mobileCard={mobileCard}
        emptyMessage="No mobs found."
        loading={mobsQ.isLoading}
        fetching={mobsQ.isFetching && !mobsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="mob"
        enumOptions={{
          weakAgainst: ELEMENT_ENUM_OPTIONS,
          strongAgainst: ELEMENT_ENUM_OPTIONS,
          immuneTo: ELEMENT_ENUM_OPTIONS,
        }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="mob"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={<PinnedSearchesMenu entity="mob" />}
      />
    </TablePageLayout>
  );
}
