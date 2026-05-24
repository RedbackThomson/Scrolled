import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './ItemsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Items() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
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
        q: state.q,
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listItems({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = itemsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Items</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Items extracted from <code className="font-mono text-xs">Item.wz</code>, joined with
          localized names from <code className="font-mono text-xs">String.wz</code>.
        </p>
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No items yet. Load <code className="font-mono">Item.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        ) : (
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
            emptyMessage="No items found."
            loading={itemsQ.isLoading}
            fetching={itemsQ.isFetching && !itemsQ.isLoading}
            columnFilters={filters}
            onColumnFilterChange={(id, v) => {
              setFilter(id, v);
              setState({ page: 1 });
            }}
            enumOptions={{ category: categoriesQ.data ?? [] }}
            searchValue={state.q}
            onSearchChange={(v) => setState({ q: v, page: 1 })}
            searchPlaceholder="Search items by name"
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
          />
        )}
      </section>
    </div>
  );
}
