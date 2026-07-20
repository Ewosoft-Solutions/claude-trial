'use client';

/* ============================================================
   ChatComposer — the message input row

   Controlled textarea + send button. Enter sends, Shift+Enter
   inserts a newline; the send button disables while the value is
   empty or a reply is in flight (`busy`). All copy (placeholder,
   labels, hint) is consumer-supplied.
   ============================================================ */

import * as React from 'react';
import { SendHorizontal } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Textarea } from '@workspace/ui/components/textarea';
import { cn } from '@workspace/ui/lib/utils';

export interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Called with the trimmed message when the user sends. */
  onSend: (message: string) => void;
  /** A reply is in flight: sending is disabled, input stays editable. */
  busy?: boolean;
  /** Fully disable the composer (e.g. feature unavailable). */
  disabled?: boolean;
  placeholder?: string;
  /** Accessible label for the textarea. */
  inputLabel: string;
  /** Accessible label for the send button. */
  sendLabel: string;
  /** Small print under the input (shortcuts, disclaimers…). */
  hint?: React.ReactNode;
  className?: string;
}

export function ChatComposer({
  value,
  onValueChange,
  onSend,
  busy = false,
  disabled = false,
  placeholder,
  inputLabel,
  sendLabel,
  hint,
  className,
}: ChatComposerProps) {
  const canSend = !busy && !disabled && value.trim().length > 0;

  const send = React.useCallback(() => {
    const message = value.trim();
    if (!message || busy || disabled) return;
    onSend(message);
  }, [value, busy, disabled, onSend]);

  return (
    <form
      className={cn('flex flex-col gap-1.5', className)}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label={inputLabel}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={sendLabel}
          disabled={!canSend}
        >
          <SendHorizontal />
        </Button>
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </form>
  );
}
