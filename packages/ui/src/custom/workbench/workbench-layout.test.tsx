import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkbenchLayout } from './workbench-layout';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People', badge: 12 },
];

describe('WorkbenchLayout', () => {
  it('renders the title, context bar and active section', () => {
    render(
      <WorkbenchLayout
        title="People"
        context={<span>Term 1 · Campus A</span>}
        tabs={TABS}
        activeTab="overview"
      >
        <div>overview content</div>
      </WorkbenchLayout>,
    );
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('Term 1 · Campus A')).toBeInTheDocument();
    expect(screen.getByText('overview content')).toBeInTheDocument();
  });

  it('renders a tab strip and fires onTabChange', () => {
    const onTabChange = vi.fn();
    render(
      <WorkbenchLayout
        tabs={TABS}
        activeTab="overview"
        onTabChange={onTabChange}
      >
        <div>content</div>
      </WorkbenchLayout>,
    );
    const peopleTab = screen.getByRole('tab', { name: /People/ });
    // Radix Tabs triggers activate on pointer-down (automatic mode), not click.
    fireEvent.mouseDown(peopleTab);
    expect(onTabChange).toHaveBeenCalledWith('people');
  });

  it('marks the active tab as selected for assistive tech', () => {
    render(
      <WorkbenchLayout tabs={TABS} activeTab="overview">
        <div>content</div>
      </WorkbenchLayout>,
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
