import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody, TableCell, TableRow } from './table';

describe('Table', () => {
  it('keeps every column available through a keyboard and touch scroll region', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Visible data</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole('table');
    const scrollRegion = table.parentElement;

    expect(table).toHaveClass('min-w-max');
    expect(scrollRegion).toHaveAttribute('tabindex', '0');
    expect(scrollRegion).toHaveAttribute(
      'aria-label',
      'Scrollable table. Swipe or use the arrow keys to see more columns.',
    );
  });
});
