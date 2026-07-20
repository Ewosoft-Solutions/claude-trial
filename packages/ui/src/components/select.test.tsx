import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select, SelectTrigger, SelectValue } from './select';

describe('SelectTrigger', () => {
  it('can shrink inside narrow mobile grids without widening its parent', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Class">
          <SelectValue placeholder="A very long class name" />
        </SelectTrigger>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveClass('min-w-0');
  });
});
