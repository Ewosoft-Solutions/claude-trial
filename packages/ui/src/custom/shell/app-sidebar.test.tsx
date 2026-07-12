import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NavGroup, RailItem } from '@workspace/ui/types/shell.types';

import { AppSidebar } from './app-sidebar';

function setup() {
  const onOverview = vi.fn();
  const onDashboard = vi.fn();
  const onStudents = vi.fn();
  const railItems: RailItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <span aria-hidden />,
      active: true,
      hasPanel: true,
      onPanelSelect: onOverview,
    },
    {
      key: 'students',
      label: 'Students',
      icon: <span aria-hidden />,
      hasPanel: true,
      onPanelSelect: onStudents,
    },
  ];
  const navGroups: NavGroup[] = [
    {
      key: 'home',
      items: [
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: <span data-testid="secondary-icon" />,
          active: true,
          onSelect: onDashboard,
        },
      ],
    },
  ];

  render(
    <AppSidebar
      railItems={railItems}
      navHeader={{ title: 'Overview', subtitle: 'Greenfield School' }}
      navGroups={navGroups}
      navPanels={{
        overview: {
          header: { title: 'Overview', subtitle: 'Greenfield School' },
          groups: navGroups,
        },
        students: {
          header: { title: 'Students', subtitle: 'Greenfield School' },
          groups: [
            {
              key: 'records',
              items: [
                {
                  key: 'directory',
                  label: 'Directory',
                  onSelect: vi.fn(),
                },
              ],
            },
          ],
        },
      }}
    />,
  );

  return { onDashboard, onOverview, onStudents };
}

describe('AppSidebar mobile navigation', () => {
  it('opens the active section beside the compact rail and closes after navigation', () => {
    const { onDashboard, onOverview } = setup();
    const primary = screen.getByRole('navigation', {
      name: 'Mobile primary',
    });

    const overview = within(primary).getByRole('button', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-current', 'page');

    fireEvent.click(overview);

    expect(onOverview).not.toHaveBeenCalled();
    const secondary = screen.getByRole('navigation', {
      name: 'Mobile secondary',
    });
    expect(secondary).toHaveStyle({ left: 'calc(100% + 0.5px)' });
    expect(
      document.querySelectorAll('[data-slot="mobile-flyout-contour"]'),
    ).toHaveLength(1);
    expect(overview).not.toHaveAttribute('aria-current');
    expect(
      within(secondary).getByText('Greenfield School'),
    ).toBeInTheDocument();
    expect(
      within(secondary).getByRole('button', { name: 'Dashboard' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(within(secondary).queryByTestId('secondary-icon')).toBeNull();

    fireEvent.click(
      within(secondary).getByRole('button', { name: 'Dashboard' }),
    );

    expect(onDashboard).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'Mobile secondary' }),
    ).not.toBeInTheDocument();
    expect(overview).toHaveAttribute('aria-current', 'page');
  });

  it('expands into labelled rows and discloses the active secondary items inline', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

    expect(
      screen.getByRole('button', { name: 'Collapse navigation' }),
    ).toBeInTheDocument();
    const expandedPrimary = screen.getByRole('navigation', {
      name: 'Mobile primary',
    });
    const overview = within(expandedPrimary).getByRole('button', {
      name: 'Overview',
    });
    expect(overview).not.toHaveAttribute('aria-current');
    expect(
      within(expandedPrimary).getByRole('button', { name: 'Dashboard' }),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.click(overview);

    expect(
      within(expandedPrimary).queryByRole('button', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
    expect(overview).toHaveAttribute('aria-current', 'page');
  });

  it('shows an inactive section panel immediately without routing', () => {
    const { onStudents } = setup();
    const primary = screen.getByRole('navigation', {
      name: 'Mobile primary',
    });

    fireEvent.click(within(primary).getByRole('button', { name: 'Students' }));

    expect(onStudents).not.toHaveBeenCalled();
    const secondary = screen.getByRole('navigation', {
      name: 'Mobile secondary',
    });
    expect(within(secondary).getByText('Students')).toBeInTheDocument();
    expect(
      within(secondary).getByRole('button', { name: 'Directory' }),
    ).toBeInTheDocument();
  });
});
