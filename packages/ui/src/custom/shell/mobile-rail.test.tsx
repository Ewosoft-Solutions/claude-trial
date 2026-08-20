import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  NavPanelData,
  RailItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

import { MobileRail } from './mobile-rail';

const USER: UserProfile = {
  name: 'Bisi Eze',
  email: 'registrar@stjude.edu',
  initials: 'BE',
};

function setup({ onUnpin }: { onUnpin?: () => void } = {}) {
  const onOverview = vi.fn();
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
    },
    // A 5th destination: on the bottom bar this would sit behind "More"; the
    // pinned rail carries every section, so it is present here.
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
    <MobileRail
      railItems={railItems}
      railFooterItems={railFooterItems}
      navPanels={navPanels}
      user={USER}
      userMenuItems={[]}
      onUnpin={onUnpin}
    />,
  );

  return { onOverview, onFinance, onDirectory, onHelp };
}

function rail() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

describe('MobileRail — the collapsed rail pinned on phones', () => {
  it('carries every destination, not just the first few', () => {
    setup();
    for (const label of ['Overview', 'Students', 'Finance']) {
      expect(within(rail()).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(rail()).getByRole('button', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
    // Utility items sit in the footer, outside the primary nav.
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
  });

  it('routes directly when a section without a panel is tapped', () => {
    const { onFinance } = setup();
    fireEvent.click(within(rail()).getByRole('button', { name: 'Finance' }));
    expect(onFinance).toHaveBeenCalledOnce();
  });

  it('opens a section submenu as a flyout, then routes and dismisses it', () => {
    const { onDirectory } = setup();
    const students = within(rail()).getByRole('button', { name: 'Students' });

    fireEvent.click(students);
    expect(students).toHaveAttribute('aria-expanded', 'true');
    const flyout = screen.getByRole('navigation', { name: 'Secondary' });

    fireEvent.click(within(flyout).getByRole('button', { name: 'Directory' }));
    expect(onDirectory).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('navigation', { name: 'Secondary' }),
    ).not.toBeInTheDocument();
  });

  it('dismisses the flyout on Escape', () => {
    setup();
    fireEvent.click(within(rail()).getByRole('button', { name: 'Students' }));
    expect(
      screen.getByRole('navigation', { name: 'Secondary' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('navigation', { name: 'Secondary' }),
    ).not.toBeInTheDocument();
  });

  it('offers a way back to the bottom bar from the profile menu', () => {
    const onUnpin = vi.fn();
    setup({ onUnpin });

    // Radix opens its menu on pointerdown, not click.
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Bisi Eze — account menu' }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin menu' }));
    expect(onUnpin).toHaveBeenCalledOnce();
  });

  it('has no expand toggle — pinning is the compact form by design', () => {
    setup();
    expect(
      screen.queryByRole('button', { name: /expand navigation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /collapse navigation/i }),
    ).not.toBeInTheDocument();
  });
});
