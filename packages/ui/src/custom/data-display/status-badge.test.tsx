import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge, formatStatusLabel } from './status-badge';

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

  it('maps a progressive accent tone (teal) onto its hue token', () => {
    render(<StatusBadge tone="teal">Accepted</StatusBadge>);
    expect(badge()).toHaveClass('border-teal/40', 'text-teal');
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

  it('capitalises a raw lowercase status string for display', () => {
    render(<StatusBadge tone="success">published</StatusBadge>);
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.queryByText('published')).toBeNull();
  });

  it('normalises separators in a snake_case status', () => {
    render(<StatusBadge>on_loan</StatusBadge>);
    expect(screen.getByText('On loan')).toBeInTheDocument();
  });

  it('leaves an already-capitalised label unchanged (idempotent)', () => {
    render(<StatusBadge>Docs needed</StatusBadge>);
    expect(screen.getByText('Docs needed')).toBeInTheDocument();
  });

  it('does not touch composed (non-string) children like counts', () => {
    render(<StatusBadge>{5} assigned</StatusBadge>);
    // "assigned" stays lowercase because the child is not a lone string.
    expect(screen.getByText(/assigned/)).toHaveTextContent('5 assigned');
  });

  it('renders verbatim when preserveCase is set', () => {
    render(<StatusBadge preserveCase>iOS</StatusBadge>);
    expect(screen.getByText('iOS')).toBeInTheDocument();
  });

  it('formatStatusLabel normalises value casing + separators', () => {
    expect(formatStatusLabel('published')).toBe('Published');
    expect(formatStatusLabel('on_loan')).toBe('On loan');
    expect(formatStatusLabel('in-progress')).toBe('In progress');
    expect(formatStatusLabel('Paid')).toBe('Paid');
    expect(formatStatusLabel('')).toBe('');
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
