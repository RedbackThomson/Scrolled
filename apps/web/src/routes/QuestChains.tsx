import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient } from '@/db';
import {
  columns,
  defaultSort,
  defaultVisible,
  mobileCard,
  pinnedColumns,
} from './QuestChainsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function QuestChains() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const parentsQ = useQuery({
    queryKey: ['db', 'quest-chain-parents'],
    queryFn: () => client.listQuestChainParents(),
  });

  const chainsQ = useQuery({
    queryKey: [
      'db',
      'quest-chains',
      {
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listQuestChains({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = chainsQ.data?.total === 0 && !filtersActive;

  return (
    <TablePageLayout title="Quest Chains" entityPlural="quest chains" isEmpty={isEmpty}>
      <DataTable
        data={chainsQ.data?.rows ?? []}
        total={chainsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(c) => `/quest-chains/${c.id}`}
        getRowId={(c) => String(c.id)}
        mobileCard={mobileCard}
        emptyMessage="No quest chains found."
        loading={chainsQ.isLoading}
        fetching={chainsQ.isFetching && !chainsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="questChain"
        enumOptions={{ parent: parentsQ.data ?? [] }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="questChain"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={<PinnedSearchesMenu entity="questChain" />}
      />
    </TablePageLayout>
  );
}
