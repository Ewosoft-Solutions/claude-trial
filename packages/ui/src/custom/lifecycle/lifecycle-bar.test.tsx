import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LifecycleBar } from './lifecycle-bar';

const STEPS = [
  { key: 'draft', label: 'Draft', state: 'done' as const },
  { key: 'published', label: 'Published', state: 'current' as const },
  { key: 'locked', label: 'Locked', state: 'upcoming' as const },
];

describe('LifecycleBar', () => {
  it('renders each step label with an accessible list name', () => {
    render(<LifecycleBar steps={STEPS} label="Result lifecycle" />);
    expect(
      screen.getByRole('list', { name: 'Result lifecycle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('marks the current step with aria-current (not colour alone)', () => {
    render(<LifecycleBar steps={STEPS} />);
    const current = screen
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Published');
  });

  it('numbers upcoming steps and checks completed ones', () => {
    render(<LifecycleBar steps={STEPS} />);
    // The upcoming step shows its ordinal; the done step shows a check icon,
    // so its number is not rendered as text.
    expect(screen.getByText('3')).toBeInTheDocument(); // Locked (upcoming)
    expect(screen.queryByText('1')).not.toBeInTheDocument(); // Draft (done → check)
  });
});
