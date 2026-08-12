'use client';

/**
 * Shared applicant form fields — the structured guardians editor (phone +
 * WhatsApp with a same-as-phone reuse, exactly-one-primary) used by BOTH the
 * New Application form and the Edit Applicant form, so the two never drift.
 */
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

import { GUARDIAN_RELATIONSHIPS, type Guardian } from './admissions-types';

export function emptyGuardian(isPrimary: boolean): Guardian {
  return {
    fullName: '',
    relationship: isPrimary ? 'mother' : 'father',
    email: '',
    address: '',
    phoneCountryCode: '+234',
    phoneNumber: '',
    whatsappSameAsPhone: true,
    whatsappCountryCode: '+234',
    whatsappNumber: '',
    isPrimary,
  };
}

/** Map a detail record's guardians onto the editor shape (nulls → '' inputs). */
export function guardiansToEditor(
  guardians: Guardian[] | undefined,
): Guardian[] {
  if (!guardians || guardians.length === 0) return [emptyGuardian(true)];
  return guardians.map((g, i) => ({
    fullName: g.fullName ?? '',
    relationship: g.relationship ?? (i === 0 ? 'mother' : 'father'),
    email: g.email ?? '',
    address: g.address ?? '',
    phoneCountryCode: g.phoneCountryCode || '+234',
    phoneNumber: g.phoneNumber ?? '',
    whatsappSameAsPhone: g.whatsappSameAsPhone ?? true,
    whatsappCountryCode: g.whatsappCountryCode ?? '+234',
    whatsappNumber: g.whatsappNumber ?? '',
    isPrimary: i === 0,
  }));
}

/** The API payload shape for a guardian set (create + update share it). */
export function guardiansPayload(guardians: Guardian[]) {
  return guardians.map((g, i) => ({
    fullName: g.fullName.trim(),
    relationship: g.relationship,
    email: g.email?.trim() || undefined,
    address: g.address?.trim() || undefined,
    phoneCountryCode: g.phoneCountryCode.trim() || '+234',
    phoneNumber: g.phoneNumber.trim(),
    whatsappSameAsPhone: g.whatsappSameAsPhone,
    whatsappCountryCode: g.whatsappSameAsPhone
      ? undefined
      : g.whatsappCountryCode?.trim() || '+234',
    whatsappNumber: g.whatsappSameAsPhone
      ? undefined
      : g.whatsappNumber?.trim() || undefined,
    isPrimary: i === 0,
  }));
}

export function GuardiansEditor({
  guardians,
  onChange,
}: {
  guardians: Guardian[];
  onChange: (next: Guardian[]) => void;
}) {
  function setGuardian(i: number, patch: Partial<Guardian>) {
    onChange(guardians.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function addGuardian() {
    onChange([...guardians, emptyGuardian(false)]);
  }
  function removeGuardian(i: number) {
    onChange(guardians.filter((_, idx) => idx !== i));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Parents / guardians</h3>
        <Button type="button" variant="outline" size="sm" onClick={addGuardian}>
          <Plus className="mr-1 size-3.5" aria-hidden /> Add
        </Button>
      </div>
      {guardians.map((g, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {i === 0 ? 'Primary contact' : `Guardian ${i + 1}`}
            </span>
            {i > 0 && (
              <button
                type="button"
                onClick={() => removeGuardian(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove guardian"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Full name</Label>
              <Input
                value={g.fullName}
                onChange={(e) => setGuardian(i, { fullName: e.target.value })}
                placeholder="e.g. Mrs Ebele Okoro"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Relationship</Label>
              <Select
                value={g.relationship}
                onValueChange={(v) => setGuardian(i, { relationship: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GUARDIAN_RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone</Label>
            <div className="flex gap-2">
              <Input
                value={g.phoneCountryCode}
                onChange={(e) =>
                  setGuardian(i, { phoneCountryCode: e.target.value })
                }
                className="w-20"
                aria-label="Country code"
              />
              <Input
                value={g.phoneNumber}
                onChange={(e) =>
                  setGuardian(i, { phoneNumber: e.target.value })
                }
                className="flex-1"
                placeholder="801 234 5678"
                inputMode="tel"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={g.whatsappSameAsPhone}
              onCheckedChange={(v) =>
                setGuardian(i, { whatsappSameAsPhone: v === true })
              }
            />
            WhatsApp is the same as this phone number
          </label>
          {!g.whatsappSameAsPhone && (
            <div className="flex flex-col gap-1.5">
              <Label>WhatsApp number</Label>
              <div className="flex gap-2">
                <Input
                  value={g.whatsappCountryCode ?? ''}
                  onChange={(e) =>
                    setGuardian(i, { whatsappCountryCode: e.target.value })
                  }
                  className="w-20"
                  aria-label="WhatsApp country code"
                />
                <Input
                  value={g.whatsappNumber ?? ''}
                  onChange={(e) =>
                    setGuardian(i, { whatsappNumber: e.target.value })
                  }
                  className="flex-1"
                  placeholder="801 234 5678"
                  inputMode="tel"
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                value={g.email ?? ''}
                onChange={(e) => setGuardian(i, { email: e.target.value })}
                placeholder="optional"
                inputMode="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Address</Label>
              <Input
                value={g.address ?? ''}
                onChange={(e) => setGuardian(i, { address: e.target.value })}
                placeholder="optional"
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
