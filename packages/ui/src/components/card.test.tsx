import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardHeader } from './card';

describe('Card', () => {
  it('uses compact spacing on phones and restores the roomy layout above mobile', () => {
    render(
      <Card>
        <CardHeader>Heading</CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );

    const card = screen.getByText('Heading').parentElement;
    expect(card).toHaveClass('gap-4', 'py-4', 'sm:gap-6', 'sm:py-6');
    expect(screen.getByText('Heading')).toHaveClass('px-4', 'sm:px-6');
    expect(screen.getByText('Content')).toHaveClass('px-4', 'sm:px-6');
  });
});
