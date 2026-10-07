import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { useColumnFilters } from './useColumnFilters';
import { useTableUrlState } from './useTableUrlState';
import type { FacetDef } from './presets';
import type * as DbModule from '@/db';

vi.mock('@/db', async (importOriginal) => ({
  ...(await importOriginal<typeof DbModule>()),
  getDbClient: () => ({
    countMatchingMany: async (_source: string, sets: unknown[]) => sets.map(() => 3),
    columnHistogram: async () => ({
      min: 10,
      max: 30,
      binWidth: 2,
      bins: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }),
  }),
}));

const FACETS: FacetDef[] = [{ columnId: 'level', label: 'Level', hue: 148 }];

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
      source="mob"
      facets={FACETS}
      entityPlural="things"
    />
  );
}

function renderHarness(args: {
  data: Row[];
  total: number;
  onUrlUpdate?: (e: UrlUpdateEvent) => void;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NuqsTestingAdapter onUrlUpdate={args.onUrlUpdate} hasMemory>
          <Harness data={args.data} total={args.total} />
        </NuqsTestingAdapter>
      </MemoryRouter>
    </QueryClientProvider>,
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

    expect(screen.getByText(/Showing 1–\d+ of 47/)).toBeInTheDocument();
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

  it('typing in the filter field writes a name filter to the URL', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.type(screen.getByRole('textbox', { name: 'Filter by name' }), 'Alp');
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Alp');
    });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBeNull();
    });
    expect(screen.getByRole('textbox', { name: 'Filter by name' })).toHaveValue('');
  });

  it('/ focuses the filter field', async () => {
    const user = userEvent.setup();
    renderHarness({ data: ROWS, total: 3 });
    await user.keyboard('/');
    const field = screen.getByRole('textbox', { name: 'Filter by name' });
    expect(field).toHaveFocus();
    expect(field).toHaveValue('');
  });

  it('a facet pill opens its range panel and Apply writes f_<col>_min and f_<col>_max', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByRole('button', { name: 'Level' }));
    const dialog = await screen.findByRole('dialog', { name: 'Level filter' });

    const min = await within(dialog).findByRole('textbox', { name: 'Level min' });
    await user.clear(min);
    await user.type(min, '14{Enter}');
    const max = within(dialog).getByRole('textbox', { name: 'Level max' });
    await user.clear(max);
    await user.type(max, '22{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_level_min')).toBe('14');
      expect(params?.get('f_level_max')).toBe('22');
    });
    expect(screen.getByRole('button', { name: /Level\s*14 – 22/ })).toBeInTheDocument();
  });

  it('More lists the remaining columns and steps into one', async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
    renderHarness({ data: ROWS, total: 3, onUrlUpdate });

    await user.click(screen.getByRole('button', { name: 'More' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filter' });
    await user.click(within(dialog).getByText('Name'));
    await user.type(within(dialog).getByRole('searchbox', { name: 'Name contains' }), 'Gam{Enter}');

    await waitFor(() => {
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(params?.get('f_name')).toBe('Gam');
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
