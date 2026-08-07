import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

/** Resolve the badge root (the element carrying the data-slot). */
function badge() {
  return document.querySelector('[data-slot="status-badge"]') as HTMLElement;
}

describe('StatusBadge', () => {
  it('renders its children', () => {
    render(<StatusBadge>Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the neutral tone surface (soft outline) by default', () => {
    render(<StatusBadge>Draft</StatusBadge>);
    // Soft-outline pill: matching border + tinted fill + tone text.
    expect(badge()).toHaveClass('border', 'text-muted-foreground');
  });

  it('maps a semantic tone onto its status tokens (border + text)', () => {
    render(<StatusBadge tone="success">Paid</StatusBadge>);
    expect(badge()).toHaveClass('border-success/40', 'text-success');
    expect(badge()).not.toHaveClass('text-muted-foreground');
  });

  it('omits the leading dot by default and renders it on request', () => {
    const { rerender } = render(<StatusBadge>Owing</StatusBadge>);
    expect(
      document.querySelector('[data-slot="status-badge"] [aria-hidden="true"]'),
    ).toBeNull();

    rerender(
      <StatusBadge tone="warning" dot>
        Owing
      </StatusBadge>,
    );
    const dot = document.querySelector(
      '[data-slot="status-badge"] [aria-hidden="true"]',
    );
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass('bg-warning', 'rounded-full');
  });

  it('merges a custom className and forwards span attributes', () => {
    render(
      <StatusBadge className="ml-2" id="st" aria-label="status">
        Active
      </StatusBadge>,
    );
    // custom class is merged alongside the base shape classes
    expect(badge()).toHaveClass('ml-2', 'rounded-badge');
    expect(badge()).toHaveAttribute('id', 'st');
    expect(badge()).toHaveAttribute('aria-label', 'status');
  });
});
