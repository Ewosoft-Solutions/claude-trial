import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApprovalPanel } from './approval-panel';

const REQUEST = {
  title: 'Grant bursar export for Campus B',
  requestedBy: 'Ada Okafor',
  requestedAt: '2 Aug, 10:12',
  reason: 'Month-end debtor reconciliation',
};

describe('ApprovalPanel', () => {
  it('renders the request, reason and change diff', () => {
    render(
      <ApprovalPanel
        request={REQUEST}
        fields={[
          {
            key: 'scope',
            label: 'Scope',
            before: 'Campus A',
            after: 'Campus A + B',
          },
        ]}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Grant bursar export/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Month-end debtor reconciliation/),
    ).toBeInTheDocument();
    expect(screen.getByText('Campus A + B')).toBeInTheDocument();
    // The before→after relationship is announced (the arrow is visual-only).
    expect(
      screen.getByText('from', { selector: '.sr-only' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('to', { selector: '.sr-only' }),
    ).toBeInTheDocument();
  });

  it('blocks approval and explains when the reviewer is the requester (SoD)', () => {
    render(<ApprovalPanel request={REQUEST} isSelfRequest />);
    expect(screen.getByRole('button', { name: /Approve/ })).toBeDisabled();
    expect(screen.getByText(/Separation of duties/)).toBeInTheDocument();
  });

  it('shows a step-up notice and fires approve/reject', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ApprovalPanel
        request={REQUEST}
        stepUpRequired
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.getByText(/requires re-authentication/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Approve with step-up/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Reject/ }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('disables approval when the reviewer lacks permission', () => {
    render(<ApprovalPanel request={REQUEST} canApprove={false} />);
    expect(screen.getByRole('button', { name: /Approve/ })).toBeDisabled();
  });
});
