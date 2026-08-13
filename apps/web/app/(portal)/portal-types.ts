/**
 * Self-contained shapes + helpers for the public applicant portal. Kept
 * separate from the internal `(app)` admissions types so the public surface has
 * no coupling to the authed app — the public API returns exactly these shapes.
 */

import type { FormDefinition } from '@workspace/forms';

export interface IntakeStructure {
  campuses: { id: string; name: string; code: string }[];
  stages: { id: string; name: string; code: string; order: number }[];
  yearLevels: {
    id: string;
    name: string;
    code: string;
    order: number;
    stageId: string;
  }[];
  streams: { id: string; name: string; code: string }[];
}

export interface Intake {
  school: { name: string; slug: string; schoolType: string };
  structure: IntakeStructure;
  form: {
    id: string;
    version: number;
    definition: FormDefinition;
  } | null;
}

export interface Guardian {
  fullName: string;
  relationship: string;
  email: string;
  address: string;
  phoneCountryCode: string;
  phoneNumber: string;
  whatsappSameAsPhone: boolean;
  whatsappCountryCode: string;
  whatsappNumber: string;
  isPrimary: boolean;
}

export interface StatusRequirement {
  id: string;
  label: string;
  type: string;
  collectStage: string;
  required: boolean;
  status: string;
  hasDocument: boolean;
}

export interface StatusView {
  reference: string;
  applicantName: string;
  applyingFor: string;
  stage: string;
  decision: string;
  submittedDate: string | null;
  offeredAt: string | null;
  requirements: StatusRequirement[];
  stageHistory: { toStage: string; createdAt: string }[];
}

export const GENDERS = ['male', 'female', 'other'] as const;
export const GUARDIAN_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'sibling',
  'other',
] as const;

// Stage / decision / requirement colours, labels + gating come from the ONE
// shared admissions vocabulary (@/lib/admissions/status) so the public portal
// stays in lock-step with the staff surfaces — applicant-facing labels live
// there too. Re-exported here for the portal's own imports.
export { titleCase } from '@/lib/admissions/status';

// Hydration-safe (explicit locale + UTC) — matches the internal fmtDate.
export function fmtDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

export async function errorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
      error?: string;
    };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || data.error || fallback;
  } catch {
    return fallback;
  }
}

/** Read a File as base64 (no data: prefix) for the JSON upload body. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
