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
          items: [
            {
              key: 'report-cards',
              label: 'Report cards',
              onSelect: vi.fn(),
            },
          ],
        },
      ],
    },
    {
      key: 'operations',
      label: 'Operations',
      items: [
        {
          key: 'transport',
          label: 'Transport',
          onSelect: vi.fn(),
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

/** Collapse the (desktop-default) expanded sidebar into its icon rail. */
function collapse() {
  fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
}

describe('AppSidebar — canonical collapsible navigation', () => {
  it('renders one primary nav, opens expanded on desktop, and shows the brand', () => {
    setup();

    // A single primary navigation surface at every breakpoint.
    expect(document.querySelectorAll('[data-slot="app-sidebar"]')).toHaveLength(
      1,
    );
    expect(document.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(
      1,
    );
    expect(screen.getByText('SchoolWithEase')).toBeInTheDocument();
    // Expanded by default (desktop) → the collapse affordance is present.
    expect(
      screen.getByRole('button', { name: 'Collapse navigation' }),
    ).toBeInTheDocument();

    // The active section discloses its items inline (accordion).
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(
      within(primary).getByRole('button', { name: 'Dashboard' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('opens the active section as an opaque flyout beside the rail and closes after navigation', () => {
    const { onDashboard, onOverview } = setup();
    collapse();

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const overview = within(primary).getByRole('button', { name: 'Overview' });
    fireEvent.click(overview);

    expect(onOverview).not.toHaveBeenCalled();
    const secondary = screen.getByRole('navigation', { name: 'Secondary' });
    expect(secondary).toHaveStyle({ left: 'calc(100% + 0.5px)' });
    expect(
      document.querySelectorAll('[data-slot="flyout-contour"]'),
    ).toHaveLength(1);
    // Opaque surface fill for legibility.
    const fill = document
      .querySelector('[data-slot="flyout-contour"] path')
      ?.getAttribute('fill');
    expect(fill).toBe('var(--popover)');

    expect(within(secondary).getByText('Greenfield School')).toBeInTheDocument();
    const dashboard = within(secondary).getByRole('button', {
      name: 'Dashboard',
    });
    expect(dashboard).toHaveAttribute('aria-current', 'page');

    const nestedItem = within(secondary).getByRole('button', {
      name: 'Report cards',
    });
    expect(
      nestedItem.querySelector('[data-slot="nav-nested-bullet"]'),
    ).toBeTruthy();
    const groups = secondary.querySelectorAll('[data-slot="nav-group"]');
    expect(groups).toHaveLength(2);

    fireEvent.click(dashboard);
    expect(onDashboard).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'Secondary' }),
    ).not.toBeInTheDocument();
  });

  it('closes the flyout after an outside pointer press', () => {
    setup();
    collapse();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole(
        'button',
        { name: 'Overview' },
      ),
    );
    expect(
      screen.getByRole('navigation', { name: 'Secondary' }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('navigation', { name: 'Secondary' }),
    ).not.toBeInTheDocument();
  });

  it('shows an inactive section flyout immediately without routing', () => {
    const { onStudents } = setup();
    collapse();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole(
        'button',
        { name: 'Students' },
      ),
    );

    expect(onStudents).not.toHaveBeenCalled();
    const secondary = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(secondary).getByText('Students')).toBeInTheDocument();
    expect(
      within(secondary).getByRole('button', { name: 'Directory' }),
    ).toBeInTheDocument();
  });

  it('toggles the active section inline when expanded', () => {
    setup();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const overview = within(primary).getByRole('button', { name: 'Overview' });

    // Active section is disclosed inline on load.
    expect(
      within(primary).getByRole('button', { name: 'Dashboard' }),
    ).toBeInTheDocument();

    // Clicking the active section collapses its inline panel (no routing).
    fireEvent.click(overview);
    expect(
      within(primary).queryByRole('button', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
    expect(overview).toHaveAttribute('aria-current', 'page');
  });
});
