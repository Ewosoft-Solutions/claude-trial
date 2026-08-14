import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CountBadge } from './count-badge';

/** Resolve the badge root (the element carrying the data-slot). */
function badge() {
  return document.querySelector('[data-slot="count-badge"]') as HTMLElement;
}

describe('CountBadge', () => {
  it('renders the count', () => {
    render(<CountBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('is a rounded square, never a circle', () => {
    render(<CountBadge count={63} />);
    // The whole point: a two-digit count stays a rounded rect, not an oval.
    expect(badge()).toHaveClass('rounded-badge');
    expect(badge()).not.toHaveClass('rounded-full');
  });

  it('caps numeric counts at max', () => {
    render(<CountBadge count={128} max={99} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders string counts verbatim (no capping)', () => {
    render(<CountBadge count="9+" />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders nothing at zero, unless showZero', () => {
    const { rerender } = render(<CountBadge count={0} />);
    expect(badge()).toBeNull();

    rerender(<CountBadge count={0} showZero />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('applies the info tone (notification accent) by default', () => {
    render(<CountBadge count={3} />);
    expect(badge()).toHaveClass('bg-info', 'text-info-foreground');
  });

  it('maps tone + size onto their tokens', () => {
    render(
      <CountBadge count={2} tone="neutral" size="sm" />,
    );
    expect(badge()).toHaveClass('bg-muted', 'text-muted-foreground', 'h-[17px]');
  });

  it('merges a custom className and forwards span attributes', () => {
    render(
      <CountBadge count={1} className="ml-2 border-2 border-background" id="cb" />,
    );
    expect(badge()).toHaveClass('ml-2', 'border-2', 'rounded-badge');
    expect(badge()).toHaveAttribute('id', 'cb');
  });
});
