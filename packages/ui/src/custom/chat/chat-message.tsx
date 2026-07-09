'use client';

/* ============================================================
   ChatMessageBubble — one message in an assistant conversation

   User messages sit right in a primary bubble; assistant messages
   sit left on a card surface and may carry an embedded chart
   (ChatChart) and a metadata footer (timestamp, tool notes — the
   consumer supplies these). `pending` renders the typing indicator
   while a reply streams in (PRD A6 loading state). Copy stays with
   the consumer; text renders with preserved line breaks.
   ============================================================ */

import * as React from 'react';

import { ChatChart } from '@workspace/ui/custom/chat/chat-chart';
import { ChatTypingIndicator } from '@workspace/ui/custom/chat/chat-typing-indicator';
import { cn } from '@workspace/ui/lib/utils';
import type { ChatChartSpec, ChatSender } from '@workspace/ui/types/chat.types';

export interface ChatMessageBubbleProps {
  sender: ChatSender;
  /** The message text (or richer consumer-rendered content). */
  children?: React.ReactNode;
  /** Chart spec rendered beneath the text (assistant messages). */
  chart?: ChatChartSpec | null;
  /** Reply still streaming: show the typing indicator when empty. */
  pending?: boolean;
  /** Screen-reader label for the pending indicator. */
  pendingLabel?: string;
  /** Small print under the bubble (timestamp, tool activity…). */
  footer?: React.ReactNode;
  className?: string;
}

export function ChatMessageBubble({
  sender,
  children,
  chart,
  pending = false,
  pendingLabel,
  footer,
  className,
}: ChatMessageBubbleProps) {
  const isUser = sender === 'user';
  const empty = children === undefined || children === null || children === '';

  return (
    <div
      data-sender={sender}
      className={cn(
        'flex w-full flex-col gap-1.5',
        isUser ? 'items-end' : 'items-start',
        className,
      )}
    >
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-2.5 rounded-[var(--radius)] px-3.5 py-2.5 text-sm sm:max-w-[75%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-card-foreground',
        )}
      >
        {pending && empty ? (
          <ChatTypingIndicator label={pendingLabel} className="py-1" />
        ) : (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {children}
          </div>
        )}
        {chart ? <ChatChart spec={chart} /> : null}
      </div>
      {footer ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground',
            isUser ? 'justify-end' : 'justify-start',
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
