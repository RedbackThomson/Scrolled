import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { getDbClient } from '@/db';
import { labelForEquipType } from '@/lib/equipTypes';
import { columns, defaultSort, defaultVisibleForType, pinnedColumns } from './WeaponsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Weapons() {
  const client = useMemo(() => getDbClient(), []);
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);

  // When the user has pinned exactly one weapon type via the filter, the
  // visible-column set shifts so stat-relevant columns surface (M.Atk for
  // wands/staves, Atk for everything else). Falling back to the physical
  // default when zero or multiple types are active.
  const pinnedType = useMemo(() => {
    const f = filters.equipType;
    if (f && f.kind === 'string' && f.mode === 'equals' && f.value) return f.value;
    return null;
  }, [filters.equipType]);
  const defaultVisible = useMemo(() => defaultVisibleForType(pinnedType), [pinnedType]);

  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const typesQ = useQuery({
    queryKey: ['db', 'equip-types'],
    queryFn: () => client.listEquipTypes(),
  });

  const weaponsQ = useQuery({
    queryKey: [
      'db',
      'equips',
      'weapon',
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
        kind: 'weapon',
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = weaponsQ.data?.total === 0 && !state.q && !filtersActive;

  const headerTitle = pinnedType
    ? `Weapons · ${labelForEquipType(pinnedType)}`
    : 'Weapons';

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{headerTitle}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Weapons extracted from <code className="font-mono text-xs">Character.wz</code>,
          classified by <code className="font-mono text-xs">Math.floor(id / 10000)</code>.
        </p>
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No weapons yet. Load <code className="font-mono">Character.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        ) : (
          <DataTable
            data={weaponsQ.data?.rows ?? []}
            total={weaponsQ.data?.total ?? 0}
            columns={columns}
            state={state}
            setState={setState}
            defaultSort={defaultSort}
            visibleColumns={visibleColumns}
            defaultVisible={defaultVisible}
            pinnedColumns={pinnedColumns}
            rowLinkTo={(e) => `/equips/${e.id}`}
            getRowId={(e) => String(e.id)}
            emptyMessage="No weapons found."
            loading={weaponsQ.isLoading}
            fetching={weaponsQ.isFetching && !weaponsQ.isLoading}
            columnFilters={filters}
            onColumnFilterChange={(id, v) => {
              setFilter(id, v);
              setState({ page: 1 });
            }}
            enumOptions={{ equipType: typesQ.data ?? [] }}
            searchValue={state.q}
            onSearchChange={(v) => setState({ q: v, page: 1 })}
            searchPlaceholder="Search weapons by name"
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
