import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { TablePageLayout } from '@/components/TablePageLayout';
import { getDbClient } from '@/db';
import { columns, defaultSort, defaultVisible, pinnedColumns } from './QuestsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Quests() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const parentsQ = useQuery({
    queryKey: ['db', 'quest-parents'],
    queryFn: () => client.listQuestParents(),
  });

  const questsQ = useQuery({
    queryKey: [
      'db',
      'quests',
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
      client.listQuests({
        search: state.q || undefined,
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = questsQ.data?.total === 0 && !state.q && !filtersActive;

  return (
    <TablePageLayout title="Quests" entityPlural="quests" isEmpty={isEmpty}>
      <DataTable
        data={questsQ.data?.rows ?? []}
        total={questsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(q) => `/quests/${q.id}`}
        getRowId={(q) => String(q.id)}
        emptyMessage="No quests found."
        loading={questsQ.isLoading}
        fetching={questsQ.isFetching && !questsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        enumOptions={{ parent: parentsQ.data ?? [] }}
        searchValue={state.q}
        onSearchChange={(v) => setState({ q: v, page: 1 })}
        searchPlaceholder="Search quests by name"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="quest"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
      />
    </TablePageLayout>
  );
}
