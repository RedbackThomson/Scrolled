import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, useColumnFilters, useTableUrlState } from '@/components/data-table';
import { CollectionsBulkAddMenu } from '@/components/collections';
import { PinnedSearchesMenu } from '@/components/pinned-searches';
import { TablePageLayout } from '@/components/layout/TablePageLayout';
import { getDbClient, type JobRecord } from '@/db';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { columns, defaultSort, defaultVisible, mobileCard, pinnedColumns } from './SkillsColumns';

const DEFAULT_PAGE_SIZE = 50;

export default function Skills() {
  const client = useMemo(() => getDbClient(), []);
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort,
    defaultSize: DEFAULT_PAGE_SIZE,
    defaultVisible,
  });
  const { filters, setFilter, clearAll, active: filtersActive } = useColumnFilters(columns);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const showIds = useShowEntityIds((s) => s.enabled);

  const jobsQ = useQuery({
    queryKey: ['db', 'jobs'],
    queryFn: () => client.listJobs(),
    staleTime: Infinity,
  });

  // Sort by id so the enum dropdown reads in branch order
  // (0 Beginner, 100 Warrior, 110 Fighter, …, 500 Pirate, 522 Corsair).
  const jobIdValues = useMemo<readonly string[]>(
    () => (jobsQ.data ?? []).map((j: JobRecord) => String(j.id)).sort((a, b) => Number(a) - Number(b)),
    [jobsQ.data],
  );
  const jobNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const j of (jobsQ.data ?? []) as JobRecord[]) m.set(j.id, j.name);
    return m;
  }, [jobsQ.data]);
  const jobLabel = useMemo(
    () => (value: string) => {
      const id = Number(value);
      const name = jobNameById.get(id);
      if (!name) return value;
      return showIds ? `${name} · ${id}` : name;
    },
    [jobNameById, showIds],
  );

  const skillsQ = useQuery({
    queryKey: [
      'db',
      'skills',
      {
        sort: state.sort,
        dir: state.dir,
        page: state.page,
        size: state.size,
        filters,
      },
    ],
    queryFn: () =>
      client.listSkills({
        orderBy: state.sort,
        dir: state.dir,
        limit: state.size,
        offset: (state.page - 1) * state.size,
        filters,
      }),
    placeholderData: keepPreviousData,
  });

  const isEmpty = skillsQ.data?.total === 0 && !filtersActive;

  return (
    <TablePageLayout title="Skills" entityPlural="skills" isEmpty={isEmpty}>
      <DataTable
        data={skillsQ.data?.rows ?? []}
        total={skillsQ.data?.total ?? 0}
        columns={columns}
        state={state}
        setState={setState}
        defaultSort={defaultSort}
        visibleColumns={visibleColumns}
        defaultVisible={defaultVisible}
        pinnedColumns={pinnedColumns}
        rowLinkTo={(s) => `/skills/${s.id}`}
        getRowId={(s) => String(s.id)}
        mobileCard={mobileCard}
        emptyMessage="No skills found."
        loading={skillsQ.isLoading}
        fetching={skillsQ.isFetching && !skillsQ.isLoading}
        columnFilters={filters}
        onColumnFilterChange={(id, v) => {
          setFilter(id, v);
          setState({ page: 1 });
        }}
        onClearFilters={() => {
          clearAll();
          setState({ page: 1 });
        }}
        entity="skill"
        enumOptions={{ jobId: jobIdValues }}
        enumLabels={{ jobId: jobLabel }}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        toolbarExtra={
          selectedIds.size > 0 ? (
            <CollectionsBulkAddMenu
              entityType="skill"
              selectedIds={selectedIds}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : undefined
        }
        toolbarRightExtra={<PinnedSearchesMenu entity="skill" />}
      />
    </TablePageLayout>
  );
}
