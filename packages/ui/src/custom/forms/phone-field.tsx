'use client';

/**
 * Shared phone input — a country dial-code picker (flag + code) beside the local
 * number. One control across the Form engine's `phone` items and the structured
 * admissions intake (applicant guardians), so every phone field looks and
 * behaves the same. Data-shape-agnostic: the caller owns how dial code + number
 * map onto its own state.
 */
import * as React from 'react';

import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

import { COUNTRIES, flagEmoji } from './countries';

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
      <Select
        value={dialCode || defaultDialCode}
        disabled={disabled}
        onValueChange={onDialCodeChange}
      >
        <SelectTrigger className="w-32" aria-label="Country dial code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.iso2} value={c.dial}>
              {flagEmoji(c.iso2)} {c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
