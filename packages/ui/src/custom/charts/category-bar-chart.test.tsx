import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importActual) => {
  const actual = await importActual<typeof import('recharts')>();
  const { withFixedResponsiveContainer } = await import(
    '../../test/recharts-mock'
  );
  return withFixedResponsiveContainer(actual);
});

import { CategoryBarChart } from './category-bar-chart';
import type { ChartDatum, ChartSeries } from '@workspace/ui/types/chart.types';

const DATA: ChartDatum[] = [
  { month: 'Jan', applied: 88, offered: 61 },
  { month: 'Feb', applied: 64, offered: 44 },
  { month: 'Mar', applied: 52, offered: 33 },
];

const TWO_SERIES: ChartSeries[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'offered', label: 'Offered' },
];

const ONE_SERIES: ChartSeries[] = [{ key: 'applied', label: 'Applied' }];

/** Each series renders one bar layer. */
function bars() {
  return document.querySelectorAll('.recharts-bar');
}

describe('CategoryBarChart', () => {
  it('exposes the chart region with its accessible name', () => {
    render(
      <CategoryBarChart
        data={DATA}
        xKey="month"
        series={TWO_SERIES}
        aria-label="Admissions funnel"
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Admissions funnel' }),
    ).toBeInTheDocument();
  });

  it('renders one bar series per series in the default column orientation', () => {
    render(<CategoryBarChart data={DATA} xKey="month" series={TWO_SERIES} />);
    expect(bars()).toHaveLength(TWO_SERIES.length);
  });

  it('still renders the bars in the horizontal bar orientation', () => {
    render(
      <CategoryBarChart
        data={DATA}
        xKey="month"
        series={TWO_SERIES}
        orientation="bar"
      />,
    );
    expect(bars()).toHaveLength(TWO_SERIES.length);
  });

  it('shows the legend for multiple series', () => {
    render(<CategoryBarChart data={DATA} xKey="month" series={TWO_SERIES} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Offered')).toBeInTheDocument();
  });

  it('hides the legend for a single series by default', () => {
    render(<CategoryBarChart data={DATA} xKey="month" series={ONE_SERIES} />);
    expect(bars()).toHaveLength(1);
    expect(screen.queryByText('Applied')).toBeNull();
  });
});
