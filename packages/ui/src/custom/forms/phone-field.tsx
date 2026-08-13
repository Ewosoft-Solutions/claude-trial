'use client';

/**
 * Shared phone input — a SEARCHABLE country picker (flag + country name + dial
 * code) beside the local number. The picker filters as you type, by country
 * name OR dial code, so shared codes (e.g. US / Canada both +1) and multi-code
 * regions are still easy to tell apart and pick. One control across the Form
 * engine's `phone` items and the structured admissions intake, so every phone
 * field looks and behaves the same.
 *
 * Contract is unchanged: the caller owns { dialCode, number }. The picker also
 * tracks the chosen country (iso2) internally, so a shared dial code keeps
 * whichever country the user actually selected this session.
 */
import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Input } from '@workspace/ui/components/input';

import { COUNTRIES, countryByDial, flagEmoji, type Country } from './countries';

export interface PhoneFieldProps {
  dialCode: string;
  number: string;
  onDialCodeChange: (dialCode: string) => void;
  onNumberChange: (number: string) => void;
  id?: string;
  disabled?: boolean;
  numberPlaceholder?: string;
  /** Fallback dial code when none is set yet (e.g. a fresh guardian). */
  defaultDialCode?: string;
}

export function PhoneField({
  dialCode,
  number,
  onDialCodeChange,
  onNumberChange,
  id,
  disabled,
  numberPlaceholder = '801 234 5678',
  defaultDialCode = '+234',
}: PhoneFieldProps) {
  return (
    <div className="flex gap-2">
      <CountryDialPicker
        dial={dialCode || defaultDialCode}
        disabled={disabled}
        onSelect={(c) => onDialCodeChange(c.dial)}
      />
      <Input
        id={id}
        className="flex-1"
        inputMode="tel"
        value={number}
        placeholder={numberPlaceholder}
        disabled={disabled}
        onChange={(e) => onNumberChange(e.target.value)}
      />
    </div>
  );
}

/** Match a country by name (starts-with, then contains) or dial code digits. */
function matches(c: Country, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = c.name.toLowerCase();
  if (name.startsWith(q) || name.includes(q)) return true;
  const digits = q.replace(/[^0-9]/g, '');
  return digits.length > 0 && c.dial.replace('+', '').includes(digits);
}

function CountryDialPicker({
  dial,
  disabled,
  onSelect,
}: {
  dial: string;
  disabled?: boolean;
  onSelect: (country: Country) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Track the selected country by iso2 so a shared dial code (US/Canada +1)
  // keeps whichever was picked. Re-sync only when the dial changes externally.
  const [iso2, setIso2] = React.useState(() => countryByDial(dial).iso2);
  React.useEffect(() => {
    setIso2((prev) => {
      const cur = COUNTRIES.find((c) => c.iso2 === prev);
      return cur?.dial === dial ? prev : countryByDial(dial).iso2;
    });
  }, [dial]);

  const selected =
    COUNTRIES.find((c) => c.iso2 === iso2) ?? countryByDial(dial);
  const results = React.useMemo(
    () => COUNTRIES.filter((c) => matches(c, query)),
    [query],
  );

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  function choose(c: Country) {
    setIso2(c.iso2);
    onSelect(c);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = results[active];
      if (c) choose(c);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${selected.name} (${selected.dial})`}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-28 items-center justify-between gap-1 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{flagEmoji(selected.iso2)}</span>
          <span>{selected.dial}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="relative mb-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search country or code"
              className="h-8 pl-8"
              aria-label="Search country or dial code"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                No match
              </p>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.iso2}
                  type="button"
                  role="option"
                  aria-selected={c.iso2 === selected.iso2}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    i === active
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                >
                  <span aria-hidden>{flagEmoji(c.iso2)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.dial}
                  </span>
                  <Check
                    className={cn(
                      'size-3.5 shrink-0',
                      c.iso2 === selected.iso2 ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
