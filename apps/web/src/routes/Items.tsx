import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, mobileCard, pinnedColumns } from './ItemsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Items() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoriesQ = useQuery({
    queryKey: ['db', 'item-categories'],
    queryFn: () => client.listItemCategories(),
  });

  const itemsQ = useQuery({
    queryKey: [
      'db',
      'items',
      {
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listItems({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = itemsQ.data?.total === 0 && !filtersActive;

  return (
    <TablePageLayout
      title="Items"
      description="Consumables, scrolls, etc, and setup items. Equipment is listed separately."
      entityPlural="items"
      isEmpty={isEmpty}
    >
      <DataTable
        data={itemsQ.data?.rows ?? []}
        total={itemsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(i) => `/items/${i.id}`}
        getRowId={(i) => String(i.id)}
        mobileCard={mobileCard}
        emptyMessage="No items found."
        loading={itemsQ.isLoading}
        fetching={itemsQ.isFetching && !itemsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="item"
        enumOptions={{ category: categoriesQ.data ?? [] }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="item"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={<PinnedSearchesMenu entity="item" />}
      />
    </TablePageLayout>
  );
}
