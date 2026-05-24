import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './NpcsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Npcs() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const npcsQ = useQuery({
    queryKey: [
      'db',
      'npcs',
      { q: state.q, sort: state.sort, dir: state.dir, page: state.page, size: state.size, filters },
    ],
    queryFn: () =>
      client.listNpcs({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = npcsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">NPCs</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Non-player characters extracted from <code className="font-mono text-xs">Npc.wz</code> and
          joined with names from <code className="font-mono text-xs">String.wz/Npc.img</code>.
        </p>
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No NPCs yet. Load <code className="font-mono">Npc.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        ) : (
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
            emptyMessage="No NPCs found."
            loading={npcsQ.isLoading}
            fetching={npcsQ.isFetching && !npcsQ.isLoading}
            columnFilters={filters}
            onColumnFilterChange={(id, v) => {
              setFilter(id, v);
              setState({ page: 1 });
            }}
            searchValue={state.q}
            onSearchChange={(v) => setState({ q: v, page: 1 })}
            searchPlaceholder="Search NPCs by name"
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
          />
        )}
      </section>
    </div>
  );
}
