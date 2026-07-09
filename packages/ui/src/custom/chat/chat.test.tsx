import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importActual) => {
  const actual = await importActual<typeof import('recharts')>();
  const { withFixedResponsiveContainer } = await import(
    '../../test/recharts-mock'
  );
  return withFixedResponsiveContainer(actual);
});

import { ChatComposer } from './chat-composer';
import { ChatMessageBubble } from './chat-message';
import { ChatThread } from './chat-thread';
import type { ChatChartSpec } from '@workspace/ui/types/chat.types';

const DONUT: ChatChartSpec = {
  type: 'donut',
  title: 'Enrollment by status',
  slices: [
    { key: 'active', label: 'Active', value: 420 },
    { key: 'inactive', label: 'Inactive', value: 80 },
  ],
};

describe('ChatMessageBubble', () => {
  it('renders the message text', () => {
    render(<ChatMessageBubble sender="user">How many students?</ChatMessageBubble>);
    expect(screen.getByText('How many students?')).toBeInTheDocument();
  });

  it('marks the bubble with its sender', () => {
    const { container } = render(
      <ChatMessageBubble sender="assistant">420 students.</ChatMessageBubble>,
    );
    expect(container.querySelector('[data-sender="assistant"]')).not.toBeNull();
  });

  it('shows the typing indicator while pending with no text', () => {
    render(
      <ChatMessageBubble sender="assistant" pending pendingLabel="Thinking" />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('renders an embedded chart from a wire spec', () => {
    render(
      <ChatMessageBubble sender="assistant" chart={DONUT}>
        Here is the split.
      </ChatMessageBubble>,
    );
    expect(screen.getByText('Enrollment by status')).toBeInTheDocument();
    expect(
      document.querySelectorAll('.recharts-pie-sector').length,
    ).toBeGreaterThan(0);
  });

  it('renders the footer slot', () => {
    render(
      <ChatMessageBubble sender="assistant" footer={<span>2 tools used</span>}>
        Done.
      </ChatMessageBubble>,
    );
    expect(screen.getByText('2 tools used')).toBeInTheDocument();
  });
});

describe('ChatThread', () => {
  it('exposes an accessible conversation log', () => {
    render(
      <ChatThread aria-label="Conversation">
        <ChatMessageBubble sender="user">Hi</ChatMessageBubble>
      </ChatThread>,
    );
    expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
  });
});

describe('ChatComposer', () => {
  function setup(props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
    const onSend = vi.fn();
    const onValueChange = vi.fn();
    render(
      <ChatComposer
        value={props.value ?? ''}
        onValueChange={onValueChange}
        onSend={onSend}
        inputLabel="Message"
        sendLabel="Send"
        {...props}
      />,
    );
    return { onSend, onValueChange };
  }

  it('disables send while the value is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('sends the trimmed message on click', () => {
    const { onSend } = setup({ value: '  How many students?  ' });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('How many students?');
  });

  it('sends on Enter but not on Shift+Enter', () => {
    const { onSend } = setup({ value: 'Hello' });
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does not send while busy', () => {
    const { onSend } = setup({ value: 'Hello', busy: true });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), {
      key: 'Enter',
    });
    expect(onSend).not.toHaveBeenCalled();
  });
});
