import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './EquipsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Equips() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const slotsQ = useQuery({
    queryKey: ['db', 'equip-slots'],
    queryFn: () => client.listEquipSlots(),
  });

  const equipsQ = useQuery({
    queryKey: [
      'db',
      'equips',
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
      client.listEquips({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  // "No data at all" path — only show the load-WZ prompt when there are
  // genuinely zero rows AND the user hasn't narrowed the result themselves.
  const isEmpty = equipsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Equips</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Equipment stats and icons from{' '}
          <code className="font-mono text-xs">Character.wz</code>, joined with localized names from{' '}
          <code className="font-mono text-xs">String.wz/Eqp.img</code>.
        </p>
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No equips yet. Load <code className="font-mono">Character.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        ) : (
          <DataTable
            data={equipsQ.data?.rows ?? []}
            total={equipsQ.data?.total ?? 0}
            columns={columns}
            state={state}
            setState={setState}
            defaultSort={defaultSort}
            visibleColumns={visibleColumns}
            defaultVisible={defaultVisible}
            pinnedColumns={pinnedColumns}
            rowLinkTo={(e) => `/equips/${e.id}`}
            getRowId={(e) => String(e.id)}
            emptyMessage="No equips found."
            loading={equipsQ.isLoading}
            fetching={equipsQ.isFetching && !equipsQ.isLoading}
            columnFilters={filters}
            onColumnFilterChange={(id, v) => {
              setFilter(id, v);
              setState({ page: 1 });
            }}
            enumOptions={{ slot: slotsQ.data ?? [] }}
            searchValue={state.q}
            onSearchChange={(v) => setState({ q: v, page: 1 })}
            searchPlaceholder="Search equips by name"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            toolbarExtra={
              selectedIds.size > 0 ? (
                <CollectionsBulkAddMenu
                  entityType="equip"
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
