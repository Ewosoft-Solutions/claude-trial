import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DirectoryTable,
  MaskedValue,
  type DirectoryColumn,
} from './directory-table';

interface Row {
  id: string;
  name: string;
  email: string;
  emailMasked: boolean;
}

const ROWS: Row[] = [
  { id: 'r1', name: 'Ada Okafor', email: 'a***@e***.com', emailMasked: true },
  { id: 'r2', name: 'Bola Lee', email: 'bola@example.com', emailMasked: false },
];

const COLUMNS: DirectoryColumn<Row>[] = [
  { id: 'name', header: 'Name', sortable: true, cell: (r) => r.name },
  {
    id: 'email',
    header: 'Email',
    cell: (r) => <MaskedValue value={r.email} masked={r.emailMasked} />,
  },
];

function renderTable(
  props: Partial<React.ComponentProps<typeof DirectoryTable<Row>>> = {},
) {
  const defaults = {
    columns: COLUMNS,
    rows: ROWS,
    getRowId: (r: Row) => r.id,
    getRowLabel: (r: Row) => r.name,
    total: 2,
    page: 1,
    pageSize: 25,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    sort: null,
    onSortChange: vi.fn(),
  };
  return {
    props: { ...defaults, ...props },
    ...render(<DirectoryTable {...defaults} {...props} />),
  };
}

describe('DirectoryTable', () => {
  it('renders rows and cell content', () => {
    renderTable();
    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
    expect(screen.getByText('bola@example.com')).toBeInTheDocument();
  });

  it('clamps a truncate column and still renders its cell content', () => {
    renderTable({
      columns: [
        COLUMNS[0]!,
        { ...COLUMNS[1]!, truncate: true },
      ] as DirectoryColumn<Row>[],
    });
    // the value is still rendered (truncation is visual, never data loss)
    expect(screen.getByText('bola@example.com')).toBeInTheDocument();
    // the cell carries the width clamp AND the single-line wrapper, which is
    // the pair a long value needs inside a `min-w-max` table
    const cell = screen.getByText('bola@example.com').closest('td');
    expect(cell?.className).toMatch(/max-w-/);
    expect(cell?.querySelector('.truncate')).not.toBeNull();
  });

  it('leaves a column unclamped when truncate is not set', () => {
    renderTable();
    const cell = screen.getByText('bola@example.com').closest('td');
    expect(cell?.className).not.toMatch(/max-w-/);
    expect(cell?.querySelector('.truncate')).toBeNull();
  });

  it('accepts a custom width clamp on truncate', () => {
    renderTable({
      columns: [
        COLUMNS[0]!,
        { ...COLUMNS[1]!, truncate: 'max-w-[8rem]' },
      ] as DirectoryColumn<Row>[],
    });
    const cell = screen.getByText('bola@example.com').closest('td');
    expect(cell?.className).toContain('max-w-[8rem]');
  });

  it('honours isRowClickable so a row with no detail advertises none', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick, isRowClickable: (r: Row) => r.id === 'r2' });
    const [first, second] = screen.getAllByRole('row').slice(1);
    // r1 opts out: no tab stop, no "View …" label, and clicking does nothing
    expect(first).not.toHaveAttribute('tabindex');
    expect(first).not.toHaveAttribute('aria-label');
    fireEvent.click(first!);
    expect(onRowClick).not.toHaveBeenCalled();
    // r2 stays fully clickable
    expect(second).toHaveAttribute('tabindex', '0');
    fireEvent.click(second!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('marks a masked cell for assistive tech (not colour-only)', () => {
    renderTable();
    expect(
      screen.getByText('(masked, permission required)'),
    ).toBeInTheDocument();
  });

  it('exposes sort state via aria-sort and toggles on header click', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DirectoryTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        total={2}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        sort={null}
        onSortChange={onSortChange}
      />,
    );
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith('name');

    rerender(
      <DirectoryTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        total={2}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        sort={{ field: 'name', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('shows the bulk-action bar on selection and runs an action with selected ids', () => {
    const onRun = vi.fn();
    renderTable({
      selectable: true,
      bulkActions: [{ id: 'export', label: 'Export', onRun }],
    });

    // no bar before selecting
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Select all rows on this page'));

    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('2 selected');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onRun).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('renders the empty state when there are no rows', () => {
    renderTable({ rows: [], total: 0 });
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('renders an error state with a retry action', () => {
    const onRetry = vi.fn();
    renderTable({ error: 'boom', onRetry });
    expect(screen.getByText("Couldn't load this list")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('disables previous on the first page and pages forward', () => {
    const onPageChange = vi.fn();
    renderTable({ total: 100, page: 1, pageSize: 25, onPageChange });
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  const VIS_COLUMNS: DirectoryColumn<Row>[] = [
    { id: 'name', header: 'Name', cell: (r) => r.name },
    { id: 'email', header: 'Email', cell: (r) => r.email },
  ];

  it('hides a defaultHidden column by default (uncontrolled)', () => {
    renderTable({
      columns: [VIS_COLUMNS[0]!, { ...VIS_COLUMNS[1]!, defaultHidden: true }],
    });
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Email' })).toBeNull();
  });

  it('respects a controlled hiddenColumns prop over the internal default', () => {
    // No defaultHidden, but the controlled prop hides Email — proving the URL/
    // SavedView-driven set wins, which is what lets a saved view omit columns.
    renderTable({
      columns: VIS_COLUMNS,
      hiddenColumns: ['email'],
      onHiddenColumnsChange: vi.fn(),
    });
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Email' })).toBeNull();
  });
});
