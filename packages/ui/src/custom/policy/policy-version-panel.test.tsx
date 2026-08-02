import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PolicyVersionPanel } from './policy-version-panel';
import type { PolicyVersion } from '@workspace/ui/types/patterns.types';

const VERSIONS: PolicyVersion[] = [
  {
    id: 'v2',
    label: 'NERDC 2025',
    effectiveFrom: '2025-09-01',
    isActive: false,
    status: 'Draft',
  },
  {
    id: 'v1',
    label: 'NERDC 2020',
    effectiveFrom: '2020-09-01',
    isActive: true,
  },
];

describe('PolicyVersionPanel', () => {
  it('lists versions and badges the active one', () => {
    render(<PolicyVersionPanel versions={VERSIONS} selectedId="v1" />);
    expect(screen.getByRole('option', { name: /NERDC 2020/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByText(/Active/).length).toBeGreaterThan(0);
  });

  it('disables Activate for the already-active version and fires clone/compare', () => {
    const onClone = vi.fn();
    const onCompare = vi.fn();
    render(
      <PolicyVersionPanel
        versions={VERSIONS}
        selectedId="v1"
        onClone={onClone}
        onCompare={onCompare}
      />,
    );
    expect(screen.getByRole('button', { name: /Activated/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Clone to draft/ }));
    fireEvent.click(screen.getByRole('button', { name: /Compare/ }));
    expect(onClone).toHaveBeenCalledWith('v1');
    expect(onCompare).toHaveBeenCalledWith('v1');
  });

  it('activates a non-active selected version', () => {
    const onActivate = vi.fn();
    render(
      <PolicyVersionPanel
        versions={VERSIONS}
        selectedId="v2"
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Activate$/ }));
    expect(onActivate).toHaveBeenCalledWith('v2');
  });

  it('renders a before/after diff when compareRows is supplied', () => {
    render(
      <PolicyVersionPanel
        versions={VERSIONS}
        compareTitle="2020 → 2025"
        compareRows={[
          {
            key: 'subjects',
            label: 'Subjects',
            before: '9',
            after: '11',
            changed: true,
          },
          { key: 'name', label: 'Name', before: 'CCA', after: 'CCA' },
        ]}
      />,
    );
    expect(screen.getByText('2020 → 2025')).toBeInTheDocument();
    expect(screen.getByText('changed')).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: /Subjects/ }),
    ).toBeInTheDocument();
  });
});
