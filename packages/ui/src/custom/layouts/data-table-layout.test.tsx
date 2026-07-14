import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTableLayout } from './data-table-layout';

describe('DataTableLayout', () => {
  it('wraps collection headings instead of hiding important context', () => {
    render(
      <DataTableLayout
        title="A deliberately long collection title"
        description="A deliberately long description that must remain readable"
      >
        <div>Rows</div>
      </DataTableLayout>,
    );

    expect(screen.getByRole('heading')).not.toHaveClass('truncate');
    expect(
      screen.getByText('A deliberately long description that must remain readable'),
    ).not.toHaveClass('truncate');
  });
});
