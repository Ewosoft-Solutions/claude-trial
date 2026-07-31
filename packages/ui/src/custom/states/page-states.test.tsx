import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoadingState } from './loading-state';
import {
  EmptyState,
  ErrorState,
  OfflineState,
  PermissionDeniedState,
} from './page-states';

describe('page states', () => {
  it('renders an empty state with a useful next action', () => {
    render(
      <EmptyState
        title="No students yet"
        description="Add the first student to begin."
        primaryAction={{ label: 'Add student', href: '/students/new' }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No students yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add student' })).toHaveAttribute(
      'href',
      '/students/new',
    );
  });

  it('announces a recoverable error and runs its retry action', () => {
    const retry = vi.fn();
    render(
      <ErrorState
        title="Could not load attendance"
        primaryAction={{ label: 'Retry', onClick: retry }}
      />,
    );

    const state = screen.getByRole('alert');
    expect(state).toHaveAccessibleName('Could not load attendance');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('presents permission denial without exposing permission internals', () => {
    render(
      <PermissionDeniedState
        title="You don’t have access to this area"
        description="Ask a school administrator to review your access."
        primaryAction={{ label: 'Go to overview', href: '/overview' }}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'You don’t have access to this area',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/school administrator/i)).toBeInTheDocument();
    expect(screen.queryByText(/permission key/i)).not.toBeInTheDocument();
  });

  it('announces a full-surface offline state politely', () => {
    render(
      <OfflineState
        title="This page is unavailable offline"
        description="Reconnect and try again."
      />,
    );

    const state = screen.getByRole('status');
    expect(state).toHaveAttribute('aria-live', 'polite');
    expect(state).toHaveAccessibleName('This page is unavailable offline');
  });

  it('marks indeterminate loading as busy with a visible label', () => {
    render(<LoadingState label="Loading students" />);

    const state = screen.getByRole('status');
    expect(state).toHaveAttribute('aria-busy', 'true');
    expect(state).toHaveTextContent('Loading students');
  });
});
