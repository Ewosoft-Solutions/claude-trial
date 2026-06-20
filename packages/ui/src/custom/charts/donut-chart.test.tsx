import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importActual) => {
  const actual = await importActual<typeof import('recharts')>();
  const { withFixedResponsiveContainer } = await import(
    '../../test/recharts-mock'
  );
  return withFixedResponsiveContainer(actual);
});

import { DonutChart } from './donut-chart';
import type { ChartSlice } from '@workspace/ui/types/chart.types';

const SLICES: ChartSlice[] = [
  { key: 'paid', label: 'Paid', value: 72 },
  { key: 'partial', label: 'Partial', value: 13 },
  { key: 'outstanding', label: 'Outstanding', value: 15 },
];

/** Each slice renders one pie sector. */
function sectors() {
  return document.querySelectorAll('.recharts-pie-sector');
}

describe('DonutChart', () => {
  it('exposes the chart region with its accessible name', () => {
    render(<DonutChart slices={SLICES} aria-label="Fee status split" />);
    expect(
      screen.getByRole('img', { name: 'Fee status split' }),
    ).toBeInTheDocument();
  });

  it('renders one sector per slice', () => {
    render(<DonutChart slices={SLICES} />);
    expect(sectors()).toHaveLength(SLICES.length);
  });

  it('shows each slice label in the legend by default', () => {
    render(<DonutChart slices={SLICES} />);
    for (const s of SLICES) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });

  it('hides the legend when showLegend is false', () => {
    render(<DonutChart slices={SLICES} showLegend={false} />);
    // sectors still render, but the slice labels (legend-only) do not
    expect(sectors()).toHaveLength(SLICES.length);
    expect(screen.queryByText('Paid')).toBeNull();
  });

  it('renders sectors for the solid pie variant too', () => {
    render(<DonutChart slices={SLICES} variant="pie" />);
    expect(sectors()).toHaveLength(SLICES.length);
  });
});
