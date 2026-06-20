import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Meter } from './meter';

/** The inner fill element whose width encodes the ratio. */
function fill() {
  return document.querySelector(
    '[role="progressbar"] > div',
  ) as HTMLElement;
}

describe('Meter', () => {
  it('renders the label and a default rounded percentage', () => {
    render(<Meter label="Collection rate" value={30} max={120} />);
    expect(screen.getByText('Collection rate')).toBeInTheDocument();
    // 30 / 120 = 25%
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(fill()).toHaveStyle({ width: '25%' });
  });

  it('exposes accessible progressbar semantics from the raw value/max', () => {
    render(<Meter value={42} max={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '50');
  });

  it('clamps the fill to 100% when the value exceeds max', () => {
    render(<Meter value={150} max={100} />);
    expect(fill()).toHaveStyle({ width: '100%' });
    // the displayed percentage clamps too
    expect(screen.getByText('100%')).toBeInTheDocument();
    // but the raw value is preserved for assistive tech
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '150',
    );
  });

  it('clamps the fill to 0% for a negative value', () => {
    render(<Meter value={-20} />);
    expect(fill()).toHaveStyle({ width: '0%' });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('guards against a non-positive max', () => {
    render(<Meter value={10} max={0} />);
    expect(fill()).toHaveStyle({ width: '0%' });
  });

  it('prefers an explicit valueLabel over the computed percentage', () => {
    render(<Meter label="Fees" value={75} valueLabel="₦1.2m / ₦1.6m" />);
    expect(screen.getByText('₦1.2m / ₦1.6m')).toBeInTheDocument();
    expect(screen.queryByText('75%')).toBeNull();
  });

  it('hides the value entirely when hideValue is set with no label', () => {
    render(<Meter value={60} hideValue />);
    expect(screen.queryByText('60%')).toBeNull();
    // the track still renders
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('applies the tone fill colour', () => {
    render(<Meter value={50} tone="success" />);
    expect(fill()).toHaveClass('bg-success');
    expect(fill()).not.toHaveClass('bg-primary');
  });
});
