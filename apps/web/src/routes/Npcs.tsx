import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, mobileCard, pinnedColumns } from './NpcsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Npcs() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const npcsQ = useQuery({
    queryKey: [
      'db',
      'npcs',
      { sort: state.sort, dir: state.dir, page: state.page, size: state.size, filters },
    ],
    queryFn: () =>
      client.listNpcs({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = npcsQ.data?.total === 0 && !filtersActive;

  return (
    <TablePageLayout title="NPCs" entityPlural="NPCs" isEmpty={isEmpty}>
      <DataTable
        data={npcsQ.data?.rows ?? []}
        total={npcsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(n) => `/npcs/${n.id}`}
        getRowId={(n) => String(n.id)}
        mobileCard={mobileCard}
        emptyMessage="No NPCs found."
        loading={npcsQ.isLoading}
        fetching={npcsQ.isFetching && !npcsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="npc"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="npc"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={<PinnedSearchesMenu entity="npc" />}
      />
    </TablePageLayout>
  );
}
