import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importActual) => {
  const actual = await importActual<typeof import('recharts')>();
  const { withFixedResponsiveContainer } = await import(
    '../../test/recharts-mock'
  );
  return withFixedResponsiveContainer(actual);
});

import { TrendChart } from './trend-chart';
import type { ChartDatum, ChartSeries } from '@workspace/ui/types/chart.types';

const DATA: ChartDatum[] = [
  { month: 'Sep', joined: 64, left: 8 },
  { month: 'Oct', joined: 31, left: 12 },
  { month: 'Nov', joined: 22, left: 9 },
];

const TWO_SERIES: ChartSeries[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'left', label: 'Withdrew' },
];

const ONE_SERIES: ChartSeries[] = [{ key: 'joined', label: 'Joined' }];

describe('TrendChart', () => {
  it('exposes the chart region with its accessible name', () => {
    render(
      <TrendChart
        data={DATA}
        xKey="month"
        series={TWO_SERIES}
        aria-label="Enrollment movement"
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Enrollment movement' }),
    ).toBeInTheDocument();
  });

  it('renders one area band per series for the default area variant', () => {
    render(<TrendChart data={DATA} xKey="month" series={TWO_SERIES} />);
    expect(document.querySelectorAll('.recharts-area')).toHaveLength(
      TWO_SERIES.length,
    );
    expect(document.querySelector('.recharts-line')).toBeNull();
  });

  it('renders lines instead of areas for the line variant', () => {
    render(
      <TrendChart
        data={DATA}
        xKey="month"
        series={TWO_SERIES}
        variant="line"
      />,
    );
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(
      TWO_SERIES.length,
    );
    expect(document.querySelector('.recharts-area')).toBeNull();
  });

  it('shows the legend for multiple series', () => {
    render(<TrendChart data={DATA} xKey="month" series={TWO_SERIES} />);
    expect(screen.getByText('Joined')).toBeInTheDocument();
    expect(screen.getByText('Withdrew')).toBeInTheDocument();
  });

  it('hides the legend for a single series by default', () => {
    render(<TrendChart data={DATA} xKey="month" series={ONE_SERIES} />);
    // the single area still renders; its label (legend-only) does not
    expect(document.querySelectorAll('.recharts-area')).toHaveLength(1);
    expect(screen.queryByText('Joined')).toBeNull();
  });

  it('honours an explicit showLegend override for a single series', () => {
    render(
      <TrendChart
        data={DATA}
        xKey="month"
        series={ONE_SERIES}
        showLegend
      />,
    );
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });
});
