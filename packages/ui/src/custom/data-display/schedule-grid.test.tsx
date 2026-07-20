import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ScheduleGrid,
  type ScheduleEntry,
  type SchedulePeriod,
} from './schedule-grid';

const DAYS = ['Mon', 'Tue', 'Wed'];

const PERIODS: SchedulePeriod[] = [
  { key: 'p1', label: 'Period 1', time: '08:00' },
  { key: 'p2', label: 'Period 2' },
];

const ENTRIES: ScheduleEntry[] = [
  {
    key: 'e1',
    day: 'Mon',
    period: 'p1',
    title: 'Mathematics',
    subtitle: 'Room 12',
    tone: 'info',
  },
  { key: 'e2', day: 'Wed', period: 'p2', title: 'English' },
];

/** All placed-entry cards carry the tinted border container. */
function entryCards() {
  return Array.from(
    document.querySelectorAll('[role="cell"] > div'),
  ) as HTMLElement[];
}

describe('ScheduleGrid', () => {
  it('renders a column header per day plus a leading corner header', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={[]} />);
    const headers = screen.getAllByRole('columnheader');
    // one empty corner cell + one per day
    expect(headers).toHaveLength(DAYS.length + 1);
    for (const day of DAYS) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it('renders each period label with its optional time sub-label', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={[]} />);
    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(PERIODS.length);
    expect(screen.getByText('Period 1')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    // Period 2 has no time sub-label
    expect(within(rowHeaders[1]!).getByText('Period 2')).toBeInTheDocument();
    expect(within(rowHeaders[1]!).queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it('renders one body cell per (day × period)', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={[]} />);
    expect(screen.getAllByRole('cell')).toHaveLength(
      DAYS.length * PERIODS.length,
    );
  });

  it('places an entry with its title and subtitle at the matching cell', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={ENTRIES} />);
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('Room 12')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    // exactly the two placed entries are rendered as cards
    expect(entryCards()).toHaveLength(2);
  });

  it('marks unoccupied cells with the visually-hidden empty label', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={ENTRIES} />);
    // 6 cells, 2 occupied → 4 empties
    const empties = screen.getAllByText('Free');
    expect(empties).toHaveLength(DAYS.length * PERIODS.length - ENTRIES.length);
    expect(empties[0]).toHaveClass('sr-only');
  });

  it('honours a custom empty label', () => {
    render(
      <ScheduleGrid
        days={DAYS}
        periods={PERIODS}
        entries={ENTRIES}
        emptyLabel="No class"
      />,
    );
    expect(screen.getAllByText('No class').length).toBeGreaterThan(0);
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('shows at most one entry per cell — the last one wins', () => {
    const clashing: ScheduleEntry[] = [
      { key: 'a', day: 'Mon', period: 'p1', title: 'First' },
      { key: 'b', day: 'Mon', period: 'p1', title: 'Second' },
    ];
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={clashing} />);
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.queryByText('First')).toBeNull();
    expect(entryCards()).toHaveLength(1);
  });

  it('applies the tone card classes, defaulting to the neutral card', () => {
    const entries: ScheduleEntry[] = [
      { key: 'toned', day: 'Mon', period: 'p1', title: 'Toned', tone: 'success' },
      { key: 'plain', day: 'Tue', period: 'p1', title: 'Plain' },
    ];
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={entries} />);
    const toned = screen.getByText('Toned').closest('div')!;
    const plain = screen.getByText('Plain').closest('div')!;
    expect(toned).toHaveClass('bg-success/10');
    expect(plain).toHaveClass('bg-muted/60');
  });

  it('exposes table semantics on the grid container', () => {
    render(<ScheduleGrid days={DAYS} periods={PERIODS} entries={ENTRIES} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="schedule-grid"]'),
    ).toBeInTheDocument();
  });
});
