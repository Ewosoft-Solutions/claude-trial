import * as React from 'react';
import { cn } from '@workspace/ui/lib/utils';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Called when all digits are filled — lets consumers auto-submit. */
  onComplete?: (value: string) => void;
}

/**
 * Segmented OTP input — one box per digit.
 *
 * Behaviours:
 * - Typing a digit advances focus to the next box.
 * - Backspace clears the current box; if already empty, moves to the previous box.
 * - Pasting up to `length` digits fills all boxes at once.
 * - `autoComplete="one-time-code"` on the first box so mobile OS can offer the
 *   code from an SMS/email in one tap (paste path handles the fill-across).
 * - `onComplete` fires as soon as the last box is filled.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  className,
  onComplete,
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  const digits = React.useMemo<string[]>(() => {
    const arr = value.split('').slice(0, length);
    while (arr.length < length) arr.push('');
    return arr;
  }, [value, length]);

  function update(index: number, char: string) {
    const next = [...digits];
    next[index] = char;
    const joined = next.join('');
    onChange(joined);
    if (char && joined.replace(/\s/g, '').length === length) {
      onComplete?.(joined);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        update(index, '');
      } else if (index > 0) {
        update(index - 1, '');
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;

    // Handle paste into a single box (browser may fire change with multiple chars)
    if (raw.length > 1) {
      handlePasteString(raw, index);
      return;
    }

    update(index, raw);
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    e.preventDefault();
    handlePasteString(e.clipboardData.getData('text'), startIndex);
  }

  function handlePasteString(text: string, startIndex: number) {
    const digits_from_paste = text.replace(/\D/g, '').slice(0, length - startIndex);
    if (!digits_from_paste) return;

    const next = [...digits];
    for (let i = 0; i < digits_from_paste.length; i++) {
      if (startIndex + i < length) next[startIndex + i] = digits_from_paste[i]!;
    }
    const joined = next.join('');
    onChange(joined);

    const lastFilled = Math.min(startIndex + digits_from_paste.length, length - 1);
    refs.current[lastFilled]?.focus();

    if (joined.replace(/\s/g, '').length === length) onComplete?.(joined);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select();
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label="One-time verification code"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d{1}"
          maxLength={2}
          value={digit}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={cn(
            // Base — matches the shared Input component's visual token set
            'border-input bg-transparent dark:bg-input/30 border rounded-md shadow-xs',
            'text-center text-base font-semibold tabular-nums',
            'transition-[color,box-shadow] outline-none',
            // Sizing: square box that lines up with the standard h-9
            'h-10 w-10 md:h-11 md:w-11',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            'selection:bg-primary selection:text-primary-foreground',
            // Filled visual cue
            digit && 'border-ring/60',
          )}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(e, i)}
          onFocus={handleFocus}
        />
      ))}
    </div>
  );
}
