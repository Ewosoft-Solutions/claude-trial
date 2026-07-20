import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsNav } from './settings-layout';

describe('SettingsNav', () => {
  it('gives button-backed items the same responsive styling as links', () => {
    render(
      <SettingsNav
        items={[
          {
            key: 'profile',
            label: 'Profile',
            description: 'Manage your account',
            active: true,
            onSelect: () => undefined,
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /Profile/ })).toHaveClass(
      'shrink-0',
      '@3xl/main:shrink',
      'bg-secondary',
    );
    expect(screen.getByText('Profile')).toHaveClass('break-words');
    expect(screen.getByText('Profile')).not.toHaveClass('truncate');
  });
});
