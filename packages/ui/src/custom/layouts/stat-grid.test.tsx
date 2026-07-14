import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatCard, StatGrid } from './stat-grid';
import type { StatItem } from '@workspace/ui/types/layout.types';

const ITEMS: StatItem[] = [
  { key: 'enrolled', label: 'Enrolled', value: '1,420' },
  {
    key: 'attendance',
    label: 'Attendance',
    value: '94%',
    delta: { label: '+1%', direction: 'up', intent: 'positive' },
  },
  { key: 'outstanding', label: 'Outstanding', value: '₦3.1M', hint: 'vs term' },
];

/** The delta pill that wraps the glyph + label text. */
function deltaPill(label: string) {
  return screen.getByText(label);
}

describe('StatGrid', () => {
  it('renders one tile per item with its label and value', () => {
    render(<StatGrid items={ITEMS} />);
    const grid = document.querySelector('[data-slot="stat-grid"]')!;
    expect(grid.children).toHaveLength(ITEMS.length);
    for (const item of ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.value as string)).toBeInTheDocument();
    }
  });

  it('balances common stat counts instead of leaving an awkward final row', () => {
    const sixItems = [
      ...ITEMS,
      { key: 'staff', label: 'Staff', value: '42' },
      { key: 'events', label: 'Events', value: '6' },
      { key: 'revenue', label: 'Revenue', value: '₦2M' },
    ];
    const { rerender } = render(<StatGrid items={sixItems} />);
    const grid = document.querySelector(
      '[data-slot="stat-grid"]',
    ) as HTMLElement;

    expect(grid).toHaveAttribute('data-preferred-columns', '3');

    rerender(<StatGrid items={sixItems.slice(0, 5)} />);
    expect(grid).toHaveAttribute('data-preferred-columns', '3');

    rerender(<StatGrid items={sixItems.slice(0, 4)} />);
    expect(grid).toHaveAttribute('data-preferred-columns', '4');
  });

  it('keeps the requested minimum tile width as a responsive grid token', () => {
    render(<StatGrid items={ITEMS} minTileWidth={260} />);
    const grid = document.querySelector(
      '[data-slot="stat-grid"]',
    ) as HTMLElement;

    expect(grid.style.getPropertyValue('--stat-min-tile-width')).toBe('260px');
  });
});

describe('StatCard', () => {
  it('renders a non-interactive tile as a plain element', () => {
    render(<StatCard item={ITEMS[0]!} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets short mobile tiles size to their content', () => {
    render(<StatCard item={ITEMS[0]!} />);
    const card = screen.getByText('Enrolled').parentElement?.parentElement;

    expect(card).not.toHaveClass('min-h-[7.5rem]');
  });

  it('renders a link tile when given an href', () => {
    render(<StatCard item={{ ...ITEMS[0]!, href: '/students/directory' }} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/students/directory',
    );
  });

  it('renders a button tile and fires onSelect', () => {
    const onSelect = vi.fn();
    render(<StatCard item={{ ...ITEMS[0]!, onSelect }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('renders the optional hint line', () => {
    render(<StatCard item={ITEMS[2]!} />);
    expect(screen.getByText('vs term')).toBeInTheDocument();
  });

  it('colours an explicit positive delta green and negative red', () => {
    const { rerender } = render(
      <StatCard
        item={{
          key: 'a',
          label: 'A',
          value: '1',
          delta: { label: '+5%', direction: 'up', intent: 'positive' },
        }}
      />,
    );
    expect(deltaPill('+5%')).toHaveClass('text-success');

    rerender(
      <StatCard
        item={{
          key: 'b',
          label: 'B',
          value: '2',
          delta: { label: '−5%', direction: 'down', intent: 'negative' },
        }}
      />,
    );
    expect(deltaPill('−5%')).toHaveClass('text-destructive');
  });

  it('infers delta tone from direction when no intent is given', () => {
    const { rerender } = render(
      <StatCard
        item={{
          key: 'up',
          label: 'Up',
          value: '1',
          delta: { label: 'up', direction: 'up' },
        }}
      />,
    );
    expect(deltaPill('up')).toHaveClass('text-success');

    rerender(
      <StatCard
        item={{
          key: 'flat',
          label: 'Flat',
          value: '1',
          delta: { label: 'flat', direction: 'flat' },
        }}
      />,
    );
    expect(deltaPill('flat')).toHaveClass('text-muted-foreground');
  });
});
