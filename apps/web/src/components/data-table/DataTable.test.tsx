import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { useColumnFilters } from './useColumnFilters';
import { useTableUrlState } from './useTableUrlState';

interface Row {
  id: number;
  name: string;
  level: number;
}

const TEST_COLUMNS: ColumnDef<Row>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: () => <span data-testid="icon-cell">·</span>,
  },
  {
    id: 'name',
    accessorFn: (r) => r.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => <span>{row.original.name}</span>,
  },
  {
    id: 'level',
    accessorFn: (r) => r.level,
    header: 'Level',
    meta: { filter: 'number' },
    // Default for numeric columns would be desc-first; force asc-first
    // so the test's toggle sequence is deterministic.
    sortDescFirst: false,
    cell: ({ row }) => <span>{row.original.level}</span>,
  },
  {
    id: 'id',
    accessorFn: (r) => r.id,
    header: 'ID',
    cell: ({ row }) => <span data-testid={`id-${row.original.id}`}>{row.original.id}</span>,
  },
];

const DEFAULT_VISIBLE = ['icon', 'name', 'level', 'id'] as const;
const PINNED = ['icon'] as const;
const DEFAULT_SORT = { id: 'name', dir: 'asc' } as const;

interface HarnessProps {
  data: Row[];
  total: number;
}

function Harness({ data, total }: HarnessProps) {
  const { state, setState, visibleColumns } = useTableUrlState({
    defaultSort: DEFAULT_SORT,
    defaultSize: 50,
    defaultVisible: DEFAULT_VISIBLE,
  });
  const { filters, setFilter } = useColumnFilters(TEST_COLUMNS);
  return (
    <DataTable
      data={data}
      total={total}
      columns={TEST_COLUMNS}
      state={state}
      setState={setState}
      defaultSort={DEFAULT_SORT}
      visibleColumns={visibleColumns}
      defaultVisible={DEFAULT_VISIBLE}
      pinnedColumns={PINNED}
      rowLinkTo={(r) => `/things/${r.id}`}
      getRowId={(r) => String(r.id)}
      emptyMessage="No things match."
      columnFilters={filters}
      onColumnFilterChange={setFilter}
    />
  );
}

function renderHarness(args: {
  data: Row[];
  total: number;
  onUrlUpdate?: (e: UrlUpdateEvent) => void;
}) {
  return render(
    <MemoryRouter>
      <NuqsTestingAdapter onUrlUpdate={args.onUrlUpdate} hasMemory>
        <Harness data={args.data} total={args.total} />
      </NuqsTestingAdapter>
    </MemoryRouter>,
  );
}

const ROWS: Row[] = [
  { id: 1, name: 'Alpha', level: 10 },
  { id: 2, name: 'Beta', level: 20 },
  { id: 3, name: 'Gamma', level: 30 },
];

describe('DataTable', () => {
  it('renders default-visible columns and the total in the footer', () => {
    renderHarness({ data: ROWS, total: 47 });

    // Visible default columns — match exact header label so the filter
    // trigger (aria-label "Filter Name") doesn't collide.
    const head = document.querySelector('thead')!;
    expect(within(head).getByRole('button', { name: 'Name' })).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Level' })).toBeInTheDocument();

    // Rows rendered
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    // Footer reflects server `total`, not data.length
    expect(screen.getByText(/Showing 1–3 of 47/)).toBeInTheDocument();
  });

  it('clicking a sortable header writes sort + dir to the URL and resets page', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    const head = document.querySelector('thead')!;
    await user.click(within(head).getByRole('button', { name: 'Level' }));

    // First click sets sort=level (ascending — the default dir, so cleared).
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('sort')).toBe('level');
      expect(params?.get('dir')).toBeNull();
      expect(params?.get('page')).toBeNull();
    });

    await user.click(within(head).getByRole('button', { name: 'Level' }));

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('sort')).toBe('level');
      expect(params?.get('dir')).toBe('desc');
    });

    // Third click snaps back to the entity default — both params clear.
    await user.click(within(head).getByRole('button', { name: 'Level' }));

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('sort')).toBeNull();
      expect(params?.get('dir')).toBeNull();
    });
  });

  it('typing in a string column filter writes f_<col> to the URL', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    // The filter icon is a <summary> with aria-label="Filter Name". <summary>
    // doesn't have an implicit ARIA role, so query by label.
    await user.click(screen.getByLabelText('Filter Name'));
    // Default mode is `contains`, placeholder reflects it.
    await user.type(screen.getByPlaceholderText('Contains…'), 'Alp');

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Alp');
      // Default mode clears from URL.
      expect(params?.get('f_name_mode')).toBeNull();
    });

    // Clear via the Clear button — URL key drops out.
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBeNull();
    });
  });

  it('switching string filter mode writes f_<col>_mode and keeps value', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByLabelText('Filter Name'));
    await user.type(screen.getByPlaceholderText('Contains…'), 'Alp');
    await user.click(screen.getByRole('button', { name: 'Starts with' }));

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Alp');
      expect(params?.get('f_name_mode')).toBe('prefix');
    });

    // Switching back to "Contains" (the default) clears the mode key.
    await user.click(screen.getByRole('button', { name: 'Contains' }));
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Alp');
      expect(params?.get('f_name_mode')).toBeNull();
    });
  });

  it('committing a number column range writes f_<col>_min and f_<col>_max', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByLabelText('Filter Level'));
    const minInput = screen.getByLabelText('Minimum');
    const maxInput = screen.getByLabelText('Maximum');
    await user.type(minInput, '10');
    await user.tab(); // blur commits
    await user.type(maxInput, '50');
    await user.tab();

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_level_min')).toBe('10');
      expect(params?.get('f_level_max')).toBe('50');
    });
  });

  it('toggling column visibility removes the cell and writes `cols` to the URL', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    // Open the disclosure by clicking the summary
    await user.click(document.querySelector('summary')!);

    // Uncheck the "Level" column (exact match — "ID" and "Name" don't collide).
    await user.click(screen.getByRole('checkbox', { name: 'Level' }));

    // The Level header should be gone from the table head
    const head = document.querySelector('thead')!;
    await waitFor(() => {
      expect(within(head).queryByRole('button', { name: 'Level' })).toBeNull();
    });

    // URL should now have a `cols=` param with the remaining columns sorted.
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      const cols = params?.get('cols');
      expect(cols).not.toBeNull();
      // pinned `icon` plus name + id, sorted alphabetically. `level` is omitted.
      expect(cols!.split(',').sort()).toEqual(['icon', 'id', 'name']);
    });
  });
});
