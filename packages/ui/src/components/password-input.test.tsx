import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('uses the closed-eye icon while the password is hidden', () => {
    const { container } = render(
      <PasswordInput aria-label="Account password" />,
    );
    const input = screen.getByLabelText('Account password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    expect(input).toHaveAttribute('type', 'password');
    expect(container.querySelector('.lucide-eye-closed')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.lucide-eye')).toBeInTheDocument();
  });
});
