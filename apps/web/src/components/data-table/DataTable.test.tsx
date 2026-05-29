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
  const { filters, setFilter, clearAll } = useColumnFilters(TEST_COLUMNS);
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
      onClearFilters={clearAll}
      entity="mob"
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

    // Headers are plain text (sort moved into the Display Options menu);
    // scope to <thead> so they don't collide with cell text.
    const head = document.querySelector('thead')!;
    expect(within(head).getByText('Name')).toBeInTheDocument();
    expect(within(head).getByText('Level')).toBeInTheDocument();

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    expect(screen.getByText(/Showing 1–3 of 47/)).toBeInTheDocument();
  });

  it('changing Ordering in Display Options writes sort + dir to the URL and resets page', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByRole('button', { name: 'Display options' }));
    const dialog = await screen.findByRole('dialog', { name: 'Display options' });

    // Switch the sort column to "level". Default dir is 'asc' for level so
    // `dir` clears from the URL but `sort` shows up.
    await user.selectOptions(within(dialog).getByLabelText('Sort column'), 'level');
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('sort')).toBe('level');
      expect(params?.get('page')).toBeNull();
    });

    // Flip direction to descending via the ASC/DESC toggle.
    await user.click(within(dialog).getByRole('button', { name: 'Descending' }));
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('sort')).toBe('level');
      expect(params?.get('dir')).toBe('desc');
    });
  });

  it('applying a string filter via the Filter menu writes f_<col> to the URL', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByRole('button', { name: 'Filter (F)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filter' });

    // Pick the Name column from the cmdk list, then type a value and Apply.
    await user.click(within(dialog).getByText('Name'));
    await user.type(within(dialog).getByPlaceholderText(/^Name…/), 'Alp');
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Alp');
    });

    // Active filter surfaces a badge row with a Clear button.
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBeNull();
    });
  });

  it('applying a number range via the Filter menu writes f_<col>_min and f_<col>_max', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByRole('button', { name: 'Filter (F)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filter' });

    await user.click(within(dialog).getByText('Level'));
    await user.type(within(dialog).getByLabelText('Minimum'), '10');
    await user.type(within(dialog).getByLabelText('Maximum'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

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

    await user.click(screen.getByRole('button', { name: 'Display options' }));
    const dialog = await screen.findByRole('dialog', { name: 'Display options' });
    await user.click(within(dialog).getByRole('button', { name: 'Level' }));

    const head = document.querySelector('thead')!;
    await waitFor(() => {
      expect(within(head).queryByText('Level')).toBeNull();
    });

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      const cols = params?.get('cols');
      expect(cols).not.toBeNull();
      expect(cols!.split(',').sort()).toEqual(['icon', 'id', 'name']);
    });
  });
});
