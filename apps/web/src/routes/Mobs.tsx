import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './MobsColumns';

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

  // The "Bosses only" toolbar checkbox is a shortcut for the standard
  // `boss` boolean column filter (?f_boss=1). Reading/writing here goes
  // through the same column-filter state the popover uses.
  const bossFilter = filters.boss;
  const bossOnly =
    bossFilter?.kind === 'range' && bossFilter.min === 1 && bossFilter.max === 1;

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
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mobs</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Monsters extracted from <code className="font-mono text-xs">Mob.wz</code>, named via{' '}
          <code className="font-mono text-xs">String.wz/Mob.img</code>.
        </p>
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No mobs yet. Load <code className="font-mono">Mob.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        ) : (
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
            searchValue={state.q}
            onSearchChange={(v) => setState({ q: v, page: 1 })}
            searchPlaceholder="Search mobs by name"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            toolbarExtra={
              <>
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={bossOnly}
                    onChange={(e) => {
                      setFilter(
                        'boss',
                        e.target.checked
                          ? { kind: 'range', min: 1, max: 1 }
                          : null,
                      );
                      setState({ page: 1 });
                    }}
                    className="accent-primary h-3.5 w-3.5"
                  />
                  Bosses only
                </label>
                {selectedIds.size > 0 && (
                  <CollectionsBulkAddMenu
                    entityType="mob"
                    selectedIds={selectedIds}
                    onClear={() => setSelectedIds(new Set())}
                  />
                )}
              </>
            }
          />
        )}
      </section>
    </div>
  );
}
