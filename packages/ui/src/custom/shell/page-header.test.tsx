import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('wraps long meta facts instead of clipping them on narrow screens', () => {
    render(
      <PageHeader
        title="Assessments"
        meta={[
          {
            key: 'class',
            label: 'A deliberately long class and subject description',
          },
        ]}
      />,
    );

    expect(
      screen.getByText('A deliberately long class and subject description'),
    ).toHaveClass('min-w-0', 'break-words');
    expect(
      screen.getByText('A deliberately long class and subject description'),
    ).not.toHaveClass('whitespace-nowrap');
  });
});
