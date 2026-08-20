import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  NavPanelData,
  RailItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

import { MobileNav } from './mobile-nav';

const USER: UserProfile = {
  name: 'Bisi Eze',
  email: 'registrar@stjude.edu',
  initials: 'BE',
};

function setup({ onPin }: { onPin?: () => void } = {}) {
  const onOverview = vi.fn();
  const onStudents = vi.fn();
  const onAttendance = vi.fn();
  const onFinance = vi.fn();
  const onDirectory = vi.fn();
  const onHelp = vi.fn();

  const railItems: RailItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <span aria-hidden />,
      active: true,
      onSelect: onOverview,
    },
    {
      key: 'students',
      label: 'Students',
      icon: <span aria-hidden />,
      hasPanel: true,
      onSelect: onStudents,
    },
    {
      key: 'classes',
      label: 'Classes',
      icon: <span aria-hidden />,
      onSelect: vi.fn(),
    },
    {
      key: 'attendance',
      label: 'Attendance',
      icon: <span aria-hidden />,
      onSelect: onAttendance,
    },
    // 5th item — lives only behind "More", never on the bottom bar.
    {
      key: 'finance',
      label: 'Finance',
      icon: <span aria-hidden />,
      onSelect: onFinance,
    },
  ];
  const railFooterItems: RailItem[] = [
    {
      key: 'help',
      label: 'Help',
      icon: <span aria-hidden />,
      onSelect: onHelp,
    },
  ];
  const navPanels: Record<string, NavPanelData> = {
    students: {
      header: { title: 'Students' },
      groups: [
        {
          key: 'records',
          items: [
            { key: 'directory', label: 'Directory', onSelect: onDirectory },
          ],
        },
      ],
    },
  };

  render(
    <MobileNav
      railItems={railItems}
      railFooterItems={railFooterItems}
      navPanels={navPanels}
      user={USER}
      userMenuItems={[]}
      onPin={onPin}
    />,
  );

  return {
    onOverview,
    onStudents,
    onAttendance,
    onFinance,
    onDirectory,
    onHelp,
  };
}

function bar() {
  return screen.getByRole('navigation', { name: 'Primary' });
}
function openDrawer() {
  fireEvent.click(within(bar()).getByRole('button', { name: 'More' }));
  return screen.getByRole('navigation', { name: 'All sections' });
}

describe('MobileNav — bottom bar + overlay drawer', () => {
  it('shows the first four destinations plus More on the bottom bar', () => {
    setup();
    const tabBar = bar();

    for (const label of [
      'Overview',
      'Students',
      'Classes',
      'Attendance',
      'More',
    ]) {
      expect(within(tabBar).getByText(label)).toBeInTheDocument();
    }
    // The 5th destination is not on the bar — it lives in the drawer.
    expect(within(tabBar).queryByText('Finance')).not.toBeInTheDocument();
    // Active route is reflected on its tab; More is not active while a
    // primary destination owns the route.
    expect(
      within(tabBar).getByRole('button', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(tabBar).getByRole('button', { name: 'More' }),
    ).not.toHaveAttribute('aria-current', 'page');
  });

  it('navigates directly when a bottom-bar destination is tapped', () => {
    const { onStudents } = setup();
    fireEvent.click(within(bar()).getByRole('button', { name: 'Students' }));
    expect(onStudents).toHaveBeenCalledOnce();
  });

  it('opens a drawer with every section, including those off the bar', () => {
    setup();
    const drawer = openDrawer();
    for (const label of [
      'Overview',
      'Students',
      'Classes',
      'Attendance',
      'Finance',
    ]) {
      expect(within(drawer).getByText(label)).toBeInTheDocument();
    }
    // Utility items (Help) live in the drawer footer, outside the section nav.
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Help' }),
    ).toBeInTheDocument();
  });

  it('discloses a section panel inline, then navigates and closes the drawer', () => {
    const { onDirectory } = setup();
    const drawer = openDrawer();

    // Students has a panel — tapping it toggles disclosure without routing.
    fireEvent.click(within(drawer).getByRole('button', { name: 'Students' }));
    const directory = within(drawer).getByRole('button', { name: 'Directory' });
    expect(directory).toBeInTheDocument();

    // Selecting a leaf routes and dismisses the drawer.
    fireEvent.click(directory);
    expect(onDirectory).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'All sections' }),
    ).not.toBeInTheDocument();
  });

  it('offers pinning the rail from the drawer footer, and closes on choosing it', () => {
    const onPin = vi.fn();
    setup({ onPin });
    openDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Pin menu to side' }));
    expect(onPin).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'All sections' }),
    ).not.toBeInTheDocument();
  });

  it('hides the pin option when the host does not offer it', () => {
    setup();
    openDrawer();
    expect(
      screen.queryByRole('button', { name: 'Pin menu to side' }),
    ).not.toBeInTheDocument();
  });

  it('routes and closes when a leaf destination in the drawer is tapped', () => {
    const { onFinance } = setup();
    const drawer = openDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Finance' }));
    expect(onFinance).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'All sections' }),
    ).not.toBeInTheDocument();
  });
});
